import { prisma } from '@/lib/prisma';
import { unprocessable } from '@/lib/http-error';
import { toBigIntOrUndefined } from '@/lib/ids';
import type { AuthUser } from '@/lib/auth/context';
import { BaseService } from '../base/base.service';
import { TaskRepository, taskRepository } from './task.repository';
import { parseDateInput } from './task.schema';
import type { TaskWithRelations } from './task.types';

const TASK_INCLUDE = {
  column: { include: { board: true } },
  project: { include: { client: true } },
  assignee: true,
  createdBy: true,
  timeEntries: { where: { deletedAt: null }, include: { user: true } },
  labels: true,
} as const;

/**
 * A column's WIP limit caps how many live tasks it may hold. `null` / `<= 0` means "no limit".
 * `occupancy` must already exclude the task being placed, so reorders within a column never trip it.
 */
function assertColumnCapacity(wipLimit: number | null, occupancy: number): void {
  if (wipLimit != null && wipLimit > 0 && occupancy >= wipLimit) {
    throw unprocessable('The column has reached its WIP limit.', {
      columnId: [`This column allows at most ${wipLimit} task(s).`],
    });
  }
}

class TaskService extends BaseService<TaskWithRelations> {
  constructor(private readonly tasks: TaskRepository) {
    super(tasks);
  }

  selectOptions(q: string | null, projectId: string | null, boardId: string | null) {
    return this.tasks.selectOptions(q, projectId, boardId);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: TaskWithRelations | null,
    user?: AuthUser,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...data };

    // Creator is stamped once from the authed caller; updates never touch it.
    if (!existing) prepared.createdById = user?.id ?? null;

    if (typeof prepared.columnId === 'string') {
      prepared.columnId = BigInt(prepared.columnId);
    }
    // On the global board a task may carry an explicit projectId (visual tag by project/client).
    const explicitProjectId =
      'projectId' in prepared
        ? typeof prepared.projectId === 'string' && prepared.projectId !== ''
          ? BigInt(prepared.projectId as string)
          : null
        : undefined;
    delete prepared.projectId;
    // projectId is denormalized from the target column's board; on the global board (no board
    // project) the explicit tag wins, and an absent key keeps the task's current tag.
    if (prepared.columnId != null) {
      const column = await prisma.boardColumn.findUnique({
        where: { id: prepared.columnId as bigint },
        include: { board: true },
      });
      // Enforce the target column's WIP limit when a task first lands there (create) or is moved
      // in from another column via the modal edit; reorders within the same column are exempt.
      const enteringColumn = !existing || existing.columnId !== prepared.columnId;
      if (column && enteringColumn) {
        const occupancy = await prisma.task.count({
          where: {
            columnId: prepared.columnId as bigint,
            deletedAt: null,
            ...(existing ? { id: { not: existing.id } } : {}),
          },
        });
        assertColumnCapacity(column.wipLimit, occupancy);
      }
      const boardProjectId = column?.board.projectId ?? null;
      prepared.projectId =
        boardProjectId ?? explicitProjectId ?? (existing ? existing.projectId : null);
    } else if (explicitProjectId !== undefined && existing) {
      const onGlobalBoard = existing.column.board.projectId == null;
      if (onGlobalBoard) prepared.projectId = explicitProjectId;
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
    // labelIds -> implicit-m2m write: connect on create, set (full replace) on update.
    if ('labelIds' in prepared) {
      const ids = (Array.isArray(prepared.labelIds) ? (prepared.labelIds as string[]) : [])
        .map((id) => toBigIntOrUndefined(id))
        .filter((id): id is bigint => id !== undefined)
        .map((id) => ({ id }));
      delete prepared.labelIds;
      prepared.labels = existing ? { set: ids } : { connect: ids };
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
      // Enforce the destination column's WIP limit, but only when the card crosses columns:
      // a reorder within the same column adds nothing. Inside the tx, so a rejection rolls back.
      if (targetColumnId !== existing.columnId) {
        const occupancy = await tx.task.count({
          where: { columnId: targetColumnId, deletedAt: null, id: { not: existing.id } },
        });
        assertColumnCapacity(target.wipLimit, occupancy);
      }
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
        data: {
          columnId: targetColumnId,
          position,
          // Global-board moves keep the task's explicit project tag.
          projectId: target.board.projectId ?? existing.projectId,
        },
        include: TASK_INCLUDE,
      });
    });
  }
}

export const taskService = new TaskService(taskRepository);
