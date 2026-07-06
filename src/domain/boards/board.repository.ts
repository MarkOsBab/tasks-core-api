import type { Board, Prisma } from '@prisma/client';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';
import type { BoardWithRelations } from './board.types';

function applyBoardFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.projectId !== undefined && filters.projectId !== '') {
    const projectId = toBigIntOrUndefined(filters.projectId);
    if (projectId !== undefined) where.projectId = projectId;
  }
  // ?scope=global returns the project-less board.
  if (filters.scope === 'global') where.projectId = null;
  return where;
}

export class BoardRepository extends BaseRepository<BoardWithRelations> {
  constructor() {
    super(prisma.board as unknown as ModelDelegate<BoardWithRelations>, {
      searchable: ['name'],
      sortable: ['id', 'name', 'createdAt'],
      include: { project: true, columns: { orderBy: { position: 'asc' } } },
      applyFilters: applyBoardFilters,
    });
  }

  /** ?q on name, ordered by name, top 50. */
  selectOptions(q: string | null): Promise<Board[]> {
    const where: Prisma.BoardWhereInput = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    return prisma.board.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }
}

export const boardRepository = new BoardRepository();
