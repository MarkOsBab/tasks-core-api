import type { BoardColumn } from '@prisma/client';
import { dmy, strId } from '@/resources/serialize';

export function boardColumnResource(column: BoardColumn) {
  return {
    id: strId(column.id),
    boardId: strId(column.boardId),
    name: column.name,
    color: column.color,
    position: column.position,
    wipLimit: column.wipLimit,
    isTerminal: column.isTerminal,
    createdAt: dmy(column.createdAt),
  };
}
