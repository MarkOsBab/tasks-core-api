import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import type { BoardColumnRow } from './board-column.types';

function applyColumnFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.boardId !== undefined && filters.boardId !== '') {
    const boardId = toBigIntOrUndefined(filters.boardId);
    if (boardId !== undefined) where.boardId = boardId;
  }
  return where;
}

export class BoardColumnRepository extends BaseRepository<BoardColumnRow> {
  constructor() {
    super(prisma.boardColumn as unknown as ModelDelegate<BoardColumnRow>, {
      searchable: ['name'],
      sortable: ['id', 'name', 'position', 'createdAt'],
      applyFilters: applyColumnFilters,
    });
  }

  /** Board order: columns render left-to-right by position. */
  protected defaultOrderBy(filters: Record<string, string>): OrderBy {
    if (filters.boardId) return [{ position: 'asc' }, { id: 'asc' }];
    return { id: 'desc' };
  }
}

export const boardColumnRepository = new BoardColumnRepository();
