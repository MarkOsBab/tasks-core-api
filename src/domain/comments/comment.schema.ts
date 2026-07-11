import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { lmsg, optionalRequiredString, reqString } from '@/lib/validation';

// Goes through the extended client so soft-deleted tasks are NOT valid targets.
async function taskExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const task = await prisma.task.findFirst({ where: { id: bigId }, select: { id: true } });
  return task !== null;
}

export const storeCommentSchema = z
  .object({
    taskId: reqString('taskId'),
    body: reqString('body', 5000),
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

// Factory to match the updateHandler contract; comments have no unique checks so id is unused.
export function updateCommentSchema(_id: string) {
  return z
    .object({
      taskId: optionalRequiredString('taskId'),
      body: optionalRequiredString('body', 5000),
    })
    .superRefine(async (val, ctx) => {
      if (val.taskId !== undefined && !(await taskExists(val.taskId))) {
        ctx.addIssue({
          path: ['taskId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('taskId'),
        });
      }
    });
}
