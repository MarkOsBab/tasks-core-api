import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import {
  lmsg,
  nullableBool,
  nullableInt,
  nullableString,
  optionalRequiredString,
  reqString,
} from '@/lib/validation';

async function boardExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const board = await prisma.board.findFirst({ where: { id: bigId }, select: { id: true } });
  return board !== null;
}

export const storeBoardColumnSchema = z
  .object({
    boardId: reqString('boardId'),
    name: reqString('name', 255),
    color: nullableString('color', 9), // #RRGGBBAA
    wipLimit: nullableInt('wipLimit', 1),
    isTerminal: nullableBool('isTerminal'),
    position: nullableInt('position', 0),
  })
  .superRefine(async (val, ctx) => {
    if (!(await boardExists(val.boardId))) {
      ctx.addIssue({
        path: ['boardId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('boardId'),
      });
    }
  });

export function updateBoardColumnSchema(_id: string) {
  return z.object({
    name: optionalRequiredString('name', 255),
    color: nullableString('color', 9),
    wipLimit: nullableInt('wipLimit', 1),
    isTerminal: nullableBool('isTerminal'),
    position: nullableInt('position', 0),
  });
}

export const moveColumnSchema = z.object({
  position: z
    .number({
      required_error: lmsg.required('position'),
      invalid_type_error: lmsg.integer('position'),
    })
    .int(lmsg.integer('position'))
    .min(0, lmsg.min('position', 0)),
});
