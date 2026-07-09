import { prisma } from '@/lib/prisma';
import { unprocessable } from '@/lib/http-error';
import { BaseService } from '../base/base.service';
import { TimeEntryRepository, timeEntryRepository } from './time-entry.repository';
import { parseDateTimeInput } from './time-entry.schema';
import type { TimeEntryWithRelations } from './time-entry.types';

const TIME_ENTRY_INCLUDE = {
  task: { include: { project: { include: { client: true } } } },
  user: true,
} as const;
const END_AFTER_START = 'The endedAt field must be a date after startedAt.';

/** Closed-entry length for the filterable duration_seconds column (null while running). */
function elapsedSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

class TimeEntryService extends BaseService<TimeEntryWithRelations> {
  constructor(private readonly entries: TimeEntryRepository) {
    super(entries);
  }

  protected prepare(
    data: Record<string, unknown>,
    existing: TimeEntryWithRelations | null,
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = { ...data };
    if (typeof prepared.taskId === 'string') {
      prepared.taskId = BigInt(prepared.taskId);
    }
    if (typeof prepared.startedAt === 'string') {
      prepared.startedAt = parseDateTimeInput(prepared.startedAt);
    }
    if ('endedAt' in prepared) {
      prepared.endedAt =
        typeof prepared.endedAt === 'string' ? parseDateTimeInput(prepared.endedAt) : null;
    }
    // Cross-field check against the stored row: the schema only sees fields present in the body
    // (e.g. a partial update that closes an entry with just endedAt).
    const start = (prepared.startedAt ?? existing?.startedAt) as Date | null | undefined;
    const end = (prepared.endedAt ?? ('endedAt' in prepared ? null : existing?.endedAt)) as
      | Date
      | null
      | undefined;
    if (start && end && end.getTime() <= start.getTime()) {
      throw unprocessable(END_AFTER_START, { endedAt: [END_AFTER_START] });
    }
    // Keep the filterable duration column in sync with the effective range.
    prepared.durationSeconds = start && end ? elapsedSeconds(start, end) : null;
    return prepared;
  }

  /** Manual entry: the timesheet row belongs to the authenticated user. */
  async createForUser(userId: bigint, data: Record<string, unknown>): Promise<TimeEntryWithRelations> {
    return this.entries.create({ ...this.prepare(data, null), userId });
  }

  /** One running timer per user: starting a task closes whatever else was running. */
  start(userId: bigint, taskId: bigint, description?: string | null): Promise<TimeEntryWithRelations> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      // Writes bypass the soft-delete read extension, so filter deletedAt by hand.
      // Close row by row (not updateMany): each auto-closed timer stamps its own duration.
      const running = await tx.timeEntry.findMany({
        where: { userId, endedAt: null, deletedAt: null },
      });
      for (const entry of running) {
        await tx.timeEntry.update({
          where: { id: entry.id },
          data: { endedAt: now, durationSeconds: elapsedSeconds(entry.startedAt, now) },
        });
      }
      return tx.timeEntry.create({
        data: { taskId, userId, startedAt: now, description: description ?? null },
        include: TIME_ENTRY_INCLUDE,
      });
    });
  }

  /** Stops the user's running timer on a task; null when there is nothing to stop. */
  async stop(userId: bigint, taskId: bigint): Promise<TimeEntryWithRelations | null> {
    const running = await prisma.timeEntry.findFirst({
      where: { userId, taskId, endedAt: null },
      orderBy: { id: 'desc' },
    });
    if (!running) return null;
    const now = new Date();
    return prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt: now, durationSeconds: elapsedSeconds(running.startedAt, now) },
      include: TIME_ENTRY_INCLUDE,
    });
  }

  /** The user's currently running entry (any task), for restoring the UI timer on load. */
  findRunning(userId: bigint): Promise<TimeEntryWithRelations | null> {
    return prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      orderBy: { id: 'desc' },
      include: TIME_ENTRY_INCLUDE,
    });
  }
}

export const timeEntryService = new TimeEntryService(timeEntryRepository);
