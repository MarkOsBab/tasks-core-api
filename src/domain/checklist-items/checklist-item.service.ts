import type { ChecklistItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { ChecklistItemRepository, checklistItemRepository } from './checklist-item.repository';

class ChecklistItemService extends BaseService<ChecklistItem> {
  constructor(items: ChecklistItemRepository) {
    super(items);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: ChecklistItem | null,
  ): Promise<Record<string, unknown>> {
    const prepared: Record<string, unknown> = { ...data };

    if (typeof prepared.taskId === 'string') {
      prepared.taskId = BigInt(prepared.taskId); // existence validated by the schema
    }
    // New items land at the end of the task's checklist.
    if (!existing && prepared.position == null) {
      prepared.position = await prisma.checklistItem.count({
        where: { taskId: prepared.taskId as bigint, deletedAt: null },
      });
    }

    return prepared;
  }
}

export const checklistItemService = new ChecklistItemService(checklistItemRepository);
