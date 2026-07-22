import type { Prisma, Task } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import type { TaskWithRelations } from './task.types';

function applyTaskFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.projectId !== undefined && filters.projectId !== '') {
    const projectId = toBigIntOrUndefined(filters.projectId);
    if (projectId !== undefined) where.projectId = projectId;
  }
  if (filters.columnId !== undefined && filters.columnId !== '') {
    const columnId = toBigIntOrUndefined(filters.columnId);
    if (columnId !== undefined) where.columnId = columnId;
  }
  // ?boardId scopes to every column of a board (the primary board-view filter).
  if (filters.boardId !== undefined && filters.boardId !== '') {
    const boardId = toBigIntOrUndefined(filters.boardId);
    if (boardId !== undefined) where.column = { boardId };
  }
  // ?clientId reaches through the project tag (tasks without a project never match).
  if (filters.clientId !== undefined && filters.clientId !== '') {
    const clientId = toBigIntOrUndefined(filters.clientId);
    if (clientId !== undefined) where.project = { clientId };
  }
  if (filters.priority) where.priority = filters.priority;
  // ?assigneeIds=1,2 -> tasks assigned to at least one of those users.
  if (filters.assigneeIds !== undefined && filters.assigneeIds !== '') {
    const assigneeIds = filters.assigneeIds
      .split(',')
      .map((id) => toBigIntOrUndefined(id.trim()))
      .filter((id): id is bigint => id !== undefined);
    if (assigneeIds.length > 0) where.assignees = { some: { id: { in: assigneeIds } } };
  }
  // ?labelIds=1,2 -> tasks holding at least one of those labels.
  if (filters.labelIds !== undefined && filters.labelIds !== '') {
    const labelIds = filters.labelIds
      .split(',')
      .map((id) => toBigIntOrUndefined(id.trim()))
      .filter((id): id is bigint => id !== undefined);
    if (labelIds.length > 0) where.labels = { some: { id: { in: labelIds } } };
  }
  return where;
}

export class TaskRepository extends BaseRepository<TaskWithRelations> {
  constructor() {
    super(prisma.task as unknown as ModelDelegate<TaskWithRelations>, {
      searchable: ['title'],
      sortable: ['id', 'title', 'priority', 'position', 'dueDate', 'createdAt'],
      // R4: nested includes bypass the soft-delete extension — filter deletedAt by hand.
      include: {
        column: { include: { board: true } },
        project: { include: { client: true } },
        assignees: true,
        createdBy: true,
        timeEntries: { where: { deletedAt: null }, include: { user: true } },
        labels: true,
      },
      applyFilters: applyTaskFilters,
    });
  }

  /** Flat options for /tasks/select (?q, ?projectId, ?boardId) — e.g. picking a task for a time entry. */
  selectOptions(q: string | null, projectId: string | null, boardId: string | null): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = {};
    if (projectId) {
      const projectBigId = toBigIntOrUndefined(projectId);
      if (projectBigId !== undefined) where.projectId = projectBigId;
    }
    if (boardId) {
      const boardBigId = toBigIntOrUndefined(boardId);
      if (boardBigId !== undefined) where.column = { boardId: boardBigId };
    }
    if (q) where.title = { contains: q, mode: 'insensitive' };
    return prisma.task.findMany({ where, orderBy: { title: 'asc' }, take: 50 });
  }

  /** Board ordering: when scoped to a board/column/project the fallback is the kanban position. */
  protected defaultOrderBy(filters: Record<string, string>): OrderBy {
    if (filters.boardId || filters.columnId || filters.projectId) {
      return [{ position: 'asc' }, { id: 'desc' }];
    }
    return { id: 'desc' };
  }
}

export const taskRepository = new TaskRepository();
