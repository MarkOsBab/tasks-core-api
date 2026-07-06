import { dmy, strId } from '@/resources/serialize';
import type { TaskWithRelations } from './task.types';

export function taskResource(task: TaskWithRelations) {
  return {
    id: strId(task.id),
    columnId: strId(task.columnId),
    columnName: task.column.name,
    boardId: strId(task.column.boardId),
    boardName: task.column.board.name,
    // projectId is null for global/standalone tasks; guard the trashed-project name by hand (R4).
    projectId: task.projectId != null ? strId(task.projectId) : null,
    projectName: task.project && !task.project.deletedAt ? task.project.name : null,
    title: task.title,
    description: task.description,
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
