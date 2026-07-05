import { dmy, strId } from '@/resources/serialize';
import type { TaskWithRelations } from './task.types';

export function taskResource(task: TaskWithRelations) {
  return {
    id: strId(task.id),
    projectId: strId(task.projectId),
    // The soft-delete extension does not filter nested includes: guard deletedAt by hand.
    projectName: task.project && !task.project.deletedAt ? task.project.name : null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    position: task.position,
    dueDate: dmy(task.dueDate),
    assigneeId: task.assigneeId != null ? strId(task.assigneeId) : null,
    assigneeName: task.assignee
      ? `${task.assignee.name} ${task.assignee.lastName ?? ''}`.trim()
      : null,
    createdAt: dmy(task.createdAt),
  };
}
