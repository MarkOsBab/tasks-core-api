import { dmyHms, strId } from '@/resources/serialize';
import type { ProjectLearningWithRelations } from './project-learning.types';

export function projectLearningResource(learning: ProjectLearningWithRelations) {
  // R4: nested includes bypass the soft-delete extension — guard trashed relations by hand.
  const project = learning.project && !learning.project.deletedAt ? learning.project : null;
  const client = project?.client && !project.client.deletedAt ? project.client : null;
  const task = learning.task && !learning.task.deletedAt ? learning.task : null;
  const author = learning.createdBy && !learning.createdBy.deletedAt ? learning.createdBy : null;
  return {
    id: strId(learning.id),
    body: learning.body,
    projectId: strId(learning.projectId),
    projectName: project?.name ?? null,
    projectColor: project?.color ?? null,
    clientId: client ? strId(client.id) : null,
    clientName: client?.name ?? null,
    clientColor: client?.color ?? null,
    taskId: learning.taskId != null ? strId(learning.taskId) : null,
    taskTitle: task?.title ?? null,
    createdById: learning.createdById != null ? strId(learning.createdById) : null,
    createdByName: author ? `${author.name} ${author.lastName ?? ''}`.trim() : null,
    // Recorded by an AI agent through the MCP (add_learning) rather than by a human.
    viaAgent: learning.viaAgent,
    createdAt: dmyHms(learning.createdAt),
  };
}
