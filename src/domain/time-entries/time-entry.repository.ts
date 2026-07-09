import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import { parseDateTimeInput } from './time-entry.schema';
import type { TimeEntryWithRelations } from './time-entry.types';

// A filter value with an H:i component means an exact bound; date-only means whole days.
const HAS_TIME_PATTERN = /\d{1,2}:\d{1,2}/;

/** ?startedFrom / ?startedTo (d/m/Y or ISO, time optional) -> Prisma range over startedAt. */
function startedAtRange(filters: Record<string, string>): Record<string, Date> | null {
  const range: Record<string, Date> = {};
  if (filters.startedFrom) {
    const from = parseDateTimeInput(filters.startedFrom);
    if (from) range.gte = from;
  }
  if (filters.startedTo) {
    const to = parseDateTimeInput(filters.startedTo);
    if (to) {
      // Date-only upper bound is inclusive of that whole day (parse gives 00:00:00 UTC).
      if (HAS_TIME_PATTERN.test(filters.startedTo)) range.lte = to;
      else range.lt = new Date(to.getTime() + 86_400_000);
    }
  }
  return Object.keys(range).length > 0 ? range : null;
}

/** ?minDurationMinutes / ?maxDurationMinutes -> bounds in seconds (decimals allowed). */
function minutesToSeconds(value: string): number | undefined {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return undefined;
  return Math.round(minutes * 60);
}

function applyTimeEntryFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.taskId !== undefined && filters.taskId !== '') {
    const taskId = toBigIntOrUndefined(filters.taskId);
    if (taskId !== undefined) where.taskId = taskId;
  }
  if (filters.userId !== undefined && filters.userId !== '') {
    const userId = toBigIntOrUndefined(filters.userId);
    if (userId !== undefined) where.userId = userId;
  }
  // ?projectId / ?clientId scope through the task's (denormalized) project — the time-report filters.
  const task: Record<string, unknown> = {};
  if (filters.projectId !== undefined && filters.projectId !== '') {
    const projectId = toBigIntOrUndefined(filters.projectId);
    if (projectId !== undefined) task.projectId = projectId;
  }
  if (filters.clientId !== undefined && filters.clientId !== '') {
    const clientId = toBigIntOrUndefined(filters.clientId);
    if (clientId !== undefined) task.project = { clientId };
  }
  if (Object.keys(task).length > 0) where.task = task;
  // ?running=true|false — running entries have no endedAt yet.
  if (filters.running === 'true') where.endedAt = null;
  if (filters.running === 'false') where.endedAt = { not: null };
  const started = startedAtRange(filters);
  if (started) where.startedAt = started;
  // Duration bounds only match closed entries: running ones have durationSeconds NULL.
  const duration: Record<string, number> = {};
  if (filters.minDurationMinutes !== undefined && filters.minDurationMinutes !== '') {
    const min = minutesToSeconds(filters.minDurationMinutes);
    if (min !== undefined) duration.gte = min;
  }
  if (filters.maxDurationMinutes !== undefined && filters.maxDurationMinutes !== '') {
    const max = minutesToSeconds(filters.maxDurationMinutes);
    if (max !== undefined) duration.lte = max;
  }
  if (Object.keys(duration).length > 0) where.durationSeconds = duration;
  return where;
}

export class TimeEntryRepository extends BaseRepository<TimeEntryWithRelations> {
  constructor() {
    super(prisma.timeEntry as unknown as ModelDelegate<TimeEntryWithRelations>, {
      searchable: ['description'],
      sortable: ['id', 'startedAt', 'endedAt', 'durationSeconds', 'createdAt'],
      include: { task: { include: { project: { include: { client: true } } } }, user: true },
      applyFilters: applyTimeEntryFilters,
    });
  }

  /** Timesheet ordering: newest work first. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ startedAt: 'desc' }, { id: 'desc' }];
  }
}

export const timeEntryRepository = new TimeEntryRepository();
