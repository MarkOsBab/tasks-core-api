import { dmyHms, strId } from '@/resources/serialize';
import type { TimeEntryWithRelations } from './time-entry.types';

export function timeEntryResource(entry: TimeEntryWithRelations) {
  const running = entry.endedAt == null;
  const end = entry.endedAt ?? new Date();
  // R4: nested includes bypass the soft-delete extension — guard trashed relations by hand.
  const project = entry.task.project && !entry.task.project.deletedAt ? entry.task.project : null;
  const client = project?.client && !project.client.deletedAt ? project.client : null;
  return {
    id: strId(entry.id),
    taskId: strId(entry.taskId),
    taskTitle: entry.task && !entry.task.deletedAt ? entry.task.title : null,
    projectId: entry.task.projectId != null ? strId(entry.task.projectId) : null,
    projectName: project?.name ?? null,
    projectColor: project?.color ?? null,
    clientId: client ? strId(client.id) : null,
    clientName: client?.name ?? null,
    clientColor: client?.color ?? null,
    userId: strId(entry.userId),
    userName: `${entry.user.name} ${entry.user.lastName ?? ''}`.trim(),
    description: entry.description,
    startedAt: dmyHms(entry.startedAt),
    endedAt: dmyHms(entry.endedAt),
    running,
    // For running entries this is the elapsed time at serialization; the UI keeps ticking client-side.
    durationSeconds: Math.max(0, Math.floor((end.getTime() - entry.startedAt.getTime()) / 1000)),
    createdAt: dmyHms(entry.createdAt),
  };
}
