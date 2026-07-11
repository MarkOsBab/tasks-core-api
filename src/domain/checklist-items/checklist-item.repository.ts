import type { ChecklistItem } from '@prisma/client';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';

function applyChecklistItemFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.taskId !== undefined && filters.taskId !== '') {
    const taskId = toBigIntOrUndefined(filters.taskId);
    if (taskId !== undefined) where.taskId = taskId;
  }
  return where;
}

export class ChecklistItemRepository extends BaseRepository<ChecklistItem> {
  constructor() {
    super(prisma.checklistItem as unknown as ModelDelegate<ChecklistItem>, {
      searchable: ['title'],
      sortable: ['id', 'position', 'createdAt'],
      applyFilters: applyChecklistItemFilters,
    });
  }

  /** Checklists read in their manual order. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ position: 'asc' }, { id: 'asc' }];
  }
}

export const checklistItemRepository = new ChecklistItemRepository();
