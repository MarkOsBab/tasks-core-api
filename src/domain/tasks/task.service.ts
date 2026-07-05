import type { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { TaskRepository, taskRepository } from './task.repository';
import { parseDateInput } from './task.schema';
import type { TaskWithRelations } from './task.types';

class TaskService extends BaseService<TaskWithRelations> {
  constructor(private readonly tasks: TaskRepository) {
    super(tasks);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: TaskWithRelations | null,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...data };

    if (typeof prepared.projectId === 'string') {
      prepared.projectId = BigInt(prepared.projectId);
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
      if (existing) {
        delete prepared.position; // partial update without position keeps the current one
      } else {
        // New tasks land at the end of their project+status column.
        prepared.position = await prisma.task.count({
          where: {
            projectId: prepared.projectId as bigint,
            status: (prepared.status as TaskStatus | undefined) ?? 'todo',
          },
        });
      }
    }
    return prepared;
  }

  /** Kanban move: closes the origin-column gap, opens one in the destination, relocates the task. */
  move(existing: TaskWithRelations, status: TaskStatus, position: number): Promise<TaskWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Writes bypass the soft-delete read extension, so filter deletedAt by hand.
      await tx.task.updateMany({
        where: {
          projectId: existing.projectId,
          status: existing.status,
          position: { gt: existing.position },
          id: { not: existing.id },
          deletedAt: null,
        },
        data: { position: { decrement: 1 } },
      });
      await tx.task.updateMany({
        where: {
          projectId: existing.projectId,
          status,
          position: { gte: position },
          id: { not: existing.id },
          deletedAt: null,
        },
        data: { position: { increment: 1 } },
      });
      return tx.task.update({
        where: { id: existing.id },
        data: { status, position },
        include: { project: true, assignee: true },
      });
    });
  }
}

export const taskService = new TaskService(taskRepository);
