import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { lmsg, nullableString, optionalRequiredString, reqString } from '@/lib/validation';

// Prisma read (not rawExists) so soft-deleted projects are not selectable.
async function projectExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const project = await prisma.project.findFirst({ where: { id: bigId }, select: { id: true } });
  return project !== null;
}

async function projectHasBoard(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const board = await prisma.board.findFirst({ where: { projectId: bigId }, select: { id: true } });
  return board !== null;
}

async function globalBoardExists(): Promise<boolean> {
  const board = await prisma.board.findFirst({ where: { projectId: null }, select: { id: true } });
  return board !== null;
}

export const storeBoardSchema = z
  .object({
    name: reqString('name', 255),
    projectId: nullableString('projectId'),
  })
  .superRefine(async (val, ctx) => {
    if (val.projectId != null && val.projectId !== '') {
      if (!(await projectExists(val.projectId))) {
        ctx.addIssue({
          path: ['projectId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('projectId'),
        });
      } else if (await projectHasBoard(val.projectId)) {
        ctx.addIssue({
          path: ['projectId'],
          code: z.ZodIssueCode.custom,
          message: 'The project already has a board.',
        });
      }
      // No projectId => the singleton global board; reject a second one (app-level guard, no DB constraint).
    } else if (await globalBoardExists()) {
      ctx.addIssue({
        path: ['projectId'],
        code: z.ZodIssueCode.custom,
        message: 'A global board already exists.',
      });
    }
  });

// Only the name is editable; a board never changes its project.
export function updateBoardSchema(_id: string) {
  return z.object({
    name: optionalRequiredString('name', 255),
  });
}
