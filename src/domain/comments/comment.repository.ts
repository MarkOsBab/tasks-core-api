import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import type { CommentWithRelations } from './comment.types';

function applyCommentFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.taskId !== undefined && filters.taskId !== '') {
    const taskId = toBigIntOrUndefined(filters.taskId);
    if (taskId !== undefined) where.taskId = taskId;
  }
  if (filters.userId !== undefined && filters.userId !== '') {
    const userId = toBigIntOrUndefined(filters.userId);
    if (userId !== undefined) where.userId = userId;
  }
  return where;
}

export class CommentRepository extends BaseRepository<CommentWithRelations> {
  constructor() {
    super(prisma.comment as unknown as ModelDelegate<CommentWithRelations>, {
      searchable: ['body'],
      sortable: ['id', 'createdAt'],
      include: { task: { include: { assignees: true } }, user: true },
      applyFilters: applyCommentFilters,
    });
  }

  /** Comment threads read oldest-first. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ createdAt: 'asc' }, { id: 'asc' }];
  }
}

export const commentRepository = new CommentRepository();
