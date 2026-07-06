import { unprocessable } from '@/lib/http-error';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { BoardColumnRepository, boardColumnRepository } from './board-column.repository';
import type { BoardColumnRow } from './board-column.types';

class BoardColumnService extends BaseService<BoardColumnRow> {
  constructor(private readonly columns: BoardColumnRepository) {
    super(columns);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: BoardColumnRow | null,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...data };
    if (typeof prepared.boardId === 'string') prepared.boardId = BigInt(prepared.boardId);
    if (prepared.position == null) {
      if (existing) {
        delete prepared.position; // partial update keeps the current position
      } else {
        // New columns land at the end of the board.
        prepared.position = await prisma.boardColumn.count({
          where: { boardId: prepared.boardId as bigint },
        });
      }
    }
    return prepared;
  }

  /** Reorder a column within its board (same gap-close/open shape as the task move). */
  move(existing: BoardColumnRow, position: number): Promise<BoardColumnRow> {
    return prisma.$transaction(async (tx) => {
      await tx.boardColumn.updateMany({
        where: { boardId: existing.boardId, position: { gt: existing.position }, id: { not: existing.id } },
        data: { position: { decrement: 1 } },
      });
      await tx.boardColumn.updateMany({
        where: { boardId: existing.boardId, position: { gte: position }, id: { not: existing.id } },
        data: { position: { increment: 1 } },
      });
      return tx.boardColumn.update({ where: { id: existing.id }, data: { position } });
    });
  }

  /**
   * Delete policy (the task FK is RESTRICT, so tasks must be relocated first):
   * keep >=1 column per board; if the column has live tasks, require a sibling to move them to;
   * then re-pack the remaining columns' positions.
   */
  async destroyWithPolicy(existing: BoardColumnRow, moveToColumnId: string | null): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.boardColumn.count({ where: { boardId: existing.boardId } });
      if (siblings <= 1) {
        throw unprocessable('Cannot delete the only column of a board.', {
          column: ['The board must keep at least one column.'],
        });
      }

      const liveTasks = await tx.task.count({ where: { columnId: existing.id, deletedAt: null } });
      if (liveTasks > 0) {
        if (!moveToColumnId) {
          throw unprocessable('The column is not empty.', {
            moveToColumnId: ['Select a column to move the tasks to.'],
          });
        }
        const targetId = toBigIntOrUndefined(moveToColumnId);
        const target =
          targetId === undefined
            ? null
            : await tx.boardColumn.findFirst({ where: { id: targetId, boardId: existing.boardId } });
        if (!target || target.id === existing.id) {
          throw unprocessable('Invalid target column.', {
            moveToColumnId: ['The selected column is invalid.'],
          });
        }
        const tail = await tx.task.count({ where: { columnId: target.id, deletedAt: null } });
        const moving = await tx.task.findMany({
          where: { columnId: existing.id, deletedAt: null },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        for (let i = 0; i < moving.length; i++) {
          // Same board => projectId is unchanged; only columnId/position move.
          await tx.task.update({ where: { id: moving[i].id }, data: { columnId: target.id, position: tail + i } });
        }
      }

      await tx.boardColumn.delete({ where: { id: existing.id } });
      const rest = await tx.boardColumn.findMany({
        where: { boardId: existing.boardId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < rest.length; i++) {
        await tx.boardColumn.update({ where: { id: rest[i].id }, data: { position: i } });
      }
    });
  }
}

export const boardColumnService = new BoardColumnService(boardColumnRepository);
