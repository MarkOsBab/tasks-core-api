import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { TaskRepository, taskRepository } from './task.repository';
import { parseDateInput } from './task.schema';
import type { TaskWithRelations } from './task.types';

const TASK_INCLUDE = { column: { include: { board: true } }, project: true, assignee: true } as const;

class TaskService extends BaseService<TaskWithRelations> {
  constructor(private readonly tasks: TaskRepository) {
    super(tasks);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: TaskWithRelations | null,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...data };

    if (typeof prepared.columnId === 'string') {
      prepared.columnId = BigInt(prepared.columnId);
    }
    // projectId is denormalized from the target column's board (null for global/standalone tasks).
    if (prepared.columnId != null) {
      const column = await prisma.boardColumn.findUnique({
        where: { id: prepared.columnId as bigint },
        include: { board: true },
      });
      prepared.projectId = column?.board.projectId ?? null;
    }
    if ('assigneeId' in prepared) {
      prepared.assigneeId =
        typeof prepared.assigneeId === 'string' && prepared.assigneeId !== ''
          ? BigInt(prepared.assigneeId)
          : null;
    }
    if ('dueDate' in prepared) {
      prepared.dueDate =
        typeof prepared.dueDate === 'string' ? parseDateInput(prepared.dueDate) : null;
    }
    if (prepared.position == null) {
      const movingColumn =
        existing != null && prepared.columnId != null && prepared.columnId !== existing.columnId;
      if (existing && !movingColumn) {
        delete prepared.position; // partial update in the same column keeps the current position
      } else {
        // New task, or a modal edit that changes the column: land at the end of the target column.
        prepared.position = await prisma.task.count({
          where: { columnId: prepared.columnId as bigint },
        });
      }
    }
    return prepared;
  }

  /** Kanban move: closes the origin-column gap, opens one in the destination, relocates the card. */
  move(existing: TaskWithRelations, columnId: string, position: number): Promise<TaskWithRelations> {
    const targetColumnId = BigInt(columnId);
    return prisma.$transaction(async (tx) => {
      // The destination column's board drives the denormalized projectId (project <-> global moves).
      const target = await tx.boardColumn.findUniqueOrThrow({
        where: { id: targetColumnId },
        include: { board: true },
      });
      // Writes bypass the soft-delete read extension, so filter deletedAt by hand.
      await tx.task.updateMany({
        where: {
          columnId: existing.columnId,
          position: { gt: existing.position },
          id: { not: existing.id },
          deletedAt: null,
        },
        data: { position: { decrement: 1 } },
      });
      await tx.task.updateMany({
        where: {
          columnId: targetColumnId,
          position: { gte: position },
          id: { not: existing.id },
          deletedAt: null,
        },
        data: { position: { increment: 1 } },
      });
      return tx.task.update({
        where: { id: existing.id },
        data: { columnId: targetColumnId, position, projectId: target.board.projectId },
        include: TASK_INCLUDE,
      });
    });
  }
}

export const taskService = new TaskService(taskRepository);
