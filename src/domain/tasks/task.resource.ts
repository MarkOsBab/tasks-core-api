import type { Task } from '@prisma/client';
import { dmy, dmyHms, strId } from '@/resources/serialize';
import type { TaskWithRelations } from './task.types';

export function taskSelectResource(task: Pick<Task, 'id' | 'title' | 'projectId'>) {
  return {
    label: task.title,
    value: strId(task.id),
    data: { projectId: task.projectId != null ? strId(task.projectId) : null },
  };
}

function durationSeconds(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

function fullName(user: { name: string; lastName: string | null }): string {
  return `${user.name} ${user.lastName ?? ''}`.trim();
}

interface UserTimeBucket {
  userId: string;
  userName: string;
  seconds: number; // closed entries only
  running: boolean;
  elapsedSeconds: number; // running entry, as of serialization; the UI ticks from here
}

export function taskResource(task: TaskWithRelations) {
  // R4: nested includes bypass the soft-delete extension — guard trashed relations by hand.
  const project = task.project && !task.project.deletedAt ? task.project : null;
  const client = project?.client && !project.client.deletedAt ? project.client : null;

  // Time tracking is per user: everyone accumulates independently on the same task and more
  // than one user can have a live timer at once (feeds the per-user report later).
  const now = new Date();
  const byUser = new Map<string, UserTimeBucket>();
  let trackedSeconds = 0;
  // Task-level tracking window: first start ever / last close (null while nothing closed).
  let firstTrackedAt: Date | null = null;
  let lastTrackedAt: Date | null = null;
  for (const entry of task.timeEntries) {
    if (firstTrackedAt === null || entry.startedAt < firstTrackedAt) {
      firstTrackedAt = entry.startedAt;
    }
    if (entry.endedAt && (lastTrackedAt === null || entry.endedAt > lastTrackedAt)) {
      lastTrackedAt = entry.endedAt;
    }
    const key = strId(entry.userId);
    const bucket = byUser.get(key) ?? {
      userId: key,
      userName: fullName(entry.user),
      seconds: 0,
      running: false,
      elapsedSeconds: 0,
    };
    if (entry.endedAt) {
      const seconds = durationSeconds(entry.startedAt, entry.endedAt);
      bucket.seconds += seconds;
      trackedSeconds += seconds;
    } else {
      bucket.running = true;
      bucket.elapsedSeconds += durationSeconds(entry.startedAt, now);
    }
    byUser.set(key, bucket);
  }

  return {
    id: strId(task.id),
    columnId: strId(task.columnId),
    columnName: task.column.name,
    boardId: strId(task.column.boardId),
    boardName: task.column.board.name,
    projectId: task.projectId != null ? strId(task.projectId) : null,
    projectName: project?.name ?? null,
    projectColor: project?.color ?? null,
    clientId: client ? strId(client.id) : null,
    clientName: client?.name ?? null,
    clientColor: client?.color ?? null,
    title: task.title,
    description: task.description,
    priority: task.priority,
    position: task.position,
    dueDate: dmy(task.dueDate),
    assigneeId: task.assigneeId != null ? strId(task.assigneeId) : null,
    assigneeName: task.assignee ? fullName(task.assignee) : null,
    createdById: task.createdById != null ? strId(task.createdById) : null,
    createdByName: task.createdBy ? fullName(task.createdBy) : null,
    trackedSeconds,
    firstTrackedAt: dmyHms(firstTrackedAt),
    lastTrackedAt: dmyHms(lastTrackedAt),
    trackedByUser: [...byUser.values()],
    runningEntries: task.timeEntries
      .filter((entry) => entry.endedAt == null)
      .map((entry) => ({
        id: strId(entry.id),
        userId: strId(entry.userId),
        userName: fullName(entry.user),
        startedAt: dmyHms(entry.startedAt),
        elapsedSeconds: durationSeconds(entry.startedAt, now),
      })),
    createdAt: dmy(task.createdAt),
  };
}
