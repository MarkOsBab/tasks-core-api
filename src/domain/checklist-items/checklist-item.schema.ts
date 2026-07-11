import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { lmsg, nullableInt, optionalRequiredString, reqString } from '@/lib/validation';

// Soft-delete-aware (extension filters findFirst): trashed tasks are not valid targets.
async function taskExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const task = await prisma.task.findFirst({ where: { id: bigId }, select: { id: true } });
  return task !== null;
}

export const storeChecklistItemSchema = z
  .object({
    taskId: reqString('taskId'),
    title: reqString('title', 255),
    done: z.boolean().optional(),
    position: nullableInt('position', 0),
  })
  .superRefine(async (val, ctx) => {
    if (!(await taskExists(val.taskId))) {
      ctx.addIssue({
        path: ['taskId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('taskId'),
      });
    }
  });

// Factory to match the updateHandler contract; checklist items have no unique checks so id is unused.
export function updateChecklistItemSchema(_id: string) {
  return z.object({
    title: optionalRequiredString('title', 255),
    done: z.boolean().optional(),
    position: nullableInt('position', 0),
  });
}
