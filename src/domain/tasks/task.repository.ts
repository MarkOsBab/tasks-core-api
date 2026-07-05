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
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.assigneeId !== undefined && filters.assigneeId !== '') {
    const assigneeId = toBigIntOrUndefined(filters.assigneeId);
    if (assigneeId !== undefined) where.assigneeId = assigneeId;
  }
  return where;
}

export class TaskRepository extends BaseRepository<TaskWithRelations> {
  constructor() {
    super(prisma.task as unknown as ModelDelegate<TaskWithRelations>, {
      searchable: ['title'],
      sortable: ['id', 'title', 'status', 'priority', 'position', 'dueDate', 'createdAt'],
      include: { project: true, assignee: true },
      applyFilters: applyTaskFilters,
    });
  }

  /** Board ordering: within a project the fallback is the kanban column position. */
  protected defaultOrderBy(filters: Record<string, string>): OrderBy {
    if (filters.projectId) return [{ position: 'asc' }, { id: 'desc' }];
    return { id: 'desc' };
  }
}

export const taskRepository = new TaskRepository();
