import type { Board } from '@prisma/client';
import { boardColumnResource } from '@/domain/board-columns/board-column.resource';
import { dmy, strId } from '@/resources/serialize';
import type { BoardWithRelations } from './board.types';

export function boardResource(board: BoardWithRelations) {
  return {
    id: strId(board.id),
    projectId: board.projectId != null ? strId(board.projectId) : null,
    // The soft-delete extension does not filter nested includes: guard trashed projects by hand.
    projectName: board.project && !board.project.deletedAt ? board.project.name : null,
    name: board.name,
    isGlobal: board.projectId == null,
    columns: (board.columns ?? []).map(boardColumnResource),
    createdAt: dmy(board.createdAt),
  };
}

export function boardSelectResource(board: Pick<Board, 'id' | 'name' | 'projectId'>) {
  return {
    label: board.name,
    value: strId(board.id),
    data: {
      projectId: board.projectId != null ? strId(board.projectId) : null,
      isGlobal: board.projectId == null,
    },
  };
}
