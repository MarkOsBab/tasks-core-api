import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import {
  lmsg,
  nullableHexColor,
  nullableString,
  optionalEnum,
  optionalRequiredString,
  reqEnum,
  reqString,
} from '@/lib/validation';

const PROJECT_STATUS = ['draft', 'active', 'paused', 'completed', 'archived'] as const;

// exists:clients scoped to non-deleted rows (the soft-delete extension filters findFirst).
async function clientExists(value: string): Promise<boolean> {
  const id = toBigIntOrUndefined(value);
  if (id === undefined) return false;
  const client = await prisma.client.findFirst({ where: { id }, select: { id: true } });
  return client !== null;
}

export const storeProjectSchema = z
  .object({
    clientId: reqString('clientId'),
    name: reqString('name', 255),
    description: nullableString('description'),
    color: nullableHexColor('color'), // omitted -> unique color auto-assigned in the service
    status: reqEnum('status', PROJECT_STATUS).default('active'),
    startDate: nullableString('startDate'),
    endDate: nullableString('endDate'),
  })
  .superRefine(async (val, ctx) => {
    if (!(await clientExists(val.clientId))) {
      ctx.addIssue({
        path: ['clientId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('clientId'),
      });
    }
  });

export function updateProjectSchema(_id: string) {
  return z
    .object({
      clientId: optionalRequiredString('clientId'),
      name: optionalRequiredString('name', 255),
      description: nullableString('description'),
      color: nullableHexColor('color'),
      status: optionalEnum('status', PROJECT_STATUS),
      startDate: nullableString('startDate'),
      endDate: nullableString('endDate'),
    })
    .superRefine(async (val, ctx) => {
      if (val.clientId !== undefined && !(await clientExists(val.clientId))) {
        ctx.addIssue({
          path: ['clientId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('clientId'),
        });
      }
    });
}
