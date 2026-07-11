import type { ChecklistItem } from '@prisma/client';
import { strId } from '@/resources/serialize';

export function checklistItemResource(item: ChecklistItem) {
  return {
    id: strId(item.id),
    taskId: strId(item.taskId),
    title: item.title,
    done: item.done,
    position: item.position,
  };
}
