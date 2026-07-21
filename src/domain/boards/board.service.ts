import { unprocessable } from '@/lib/http-error';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { BoardRepository, boardRepository } from './board.repository';
import type { BoardWithRelations } from './board.types';

// The starting columns every new board gets (same as the boards_and_columns migration/seed).
export const DEFAULT_BOARD_COLUMNS = [
  { name: 'Pendiente', position: 0, color: '#94a3b8', isTerminal: false },
  { name: 'En progreso', position: 1, color: '#f59e0b', isTerminal: false },
  { name: 'En revisión', position: 2, color: '#8b5cf6', isTerminal: false },
  { name: 'Terminada', position: 3, color: '#22c55e', isTerminal: true },
] as const;

class BoardService extends BaseService<BoardWithRelations> {
  constructor(private readonly boards: BoardRepository) {
    super(boards);
  }

  selectOptions(q: string | null) {
    return this.boards.selectOptions(q);
  }

  protected prepare(
    data: Record<string, unknown>,
    existing: BoardWithRelations | null,
  ): Record<string, unknown> {
    const prepared = { ...data };
    if (!existing) {
      // Create: normalize projectId and seed the default columns. (Update only touches name.)
      prepared.projectId =
        typeof prepared.projectId === 'string' && prepared.projectId !== ''
          ? BigInt(prepared.projectId)
          : null;
      prepared.columns = {
        create: DEFAULT_BOARD_COLUMNS.map((c) => ({
          name: c.name,
          position: c.position,
          color: c.color,
          isTerminal: c.isTerminal,
        })),
      };
    }
    return prepared;
  }

  /** Boards are hard-deleted (structural config, not soft-deletable), with guards. */
  async delete(existing: BoardWithRelations): Promise<boolean> {
    if (existing.projectId == null) {
      throw unprocessable('The global board cannot be deleted.', {
        board: ['The global board cannot be deleted.'],
      });
    }
    const liveTasks = await prisma.task.count({
      where: { column: { boardId: existing.id }, deletedAt: null },
    });
    if (liveTasks > 0) {
      throw unprocessable('The board still has tasks.', {
        board: ['Move or delete its tasks before deleting the board.'],
      });
    }
    await prisma.board.delete({ where: { id: existing.id } });
    return true;
  }
}

export const boardService = new BoardService(boardRepository);
