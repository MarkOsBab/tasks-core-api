import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import {
  lmsg,
  nullableNumber,
  nullableString,
  optionalEnum,
  optionalRequiredString,
  reqString,
} from '@/lib/validation';

const STATUS = ['draft', 'sent', 'accepted', 'rejected'] as const;

/** Accepts d/m/Y or ISO Y-m-d; returns UTC midnight or null when invalid. */
export function parseDateInput(value: string): Date | null {
  const dmyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dmyMatch) return utcDate(Number(dmyMatch[3]), Number(dmyMatch[2]), Number(dmyMatch[1]));
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (isoMatch) return utcDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  return null;
}

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject calendar overflow (e.g. 31/02 rolling into March).
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

function nullableDate(attr: string) {
  return z
    .string({ invalid_type_error: lmsg.string(attr) })
    .refine((value) => parseDateInput(value) !== null, `The ${attr} field must be a valid date.`)
    .nullable()
    .optional();
}

const currencyField = z
  .string({ invalid_type_error: lmsg.string('currency') })
  .regex(/^[A-Za-z]{3}$/, 'The currency field must be 3 characters.')
  .nullable()
  .optional();

// Existence check via prisma (not rawExists) so soft-deleted projects are rejected.
async function projectExists(id: string): Promise<boolean> {
  const projectId = toBigIntOrUndefined(id);
  if (projectId === undefined) return false;
  const project = await prisma.project.findFirst({ where: { id: projectId }, select: { id: true } });
  return project !== null;
}

export const storeProposalSchema = z
  .object({
    projectId: reqString('projectId'),
    title: reqString('title', 255),
    description: nullableString('description'),
    amount: nullableNumber('amount', 0),
    currency: currencyField,
    status: optionalEnum('status', STATUS),
    validUntil: nullableDate('validUntil'),
  })
  .superRefine(async (val, ctx) => {
    if (!(await projectExists(val.projectId))) {
      ctx.addIssue({
        path: ['projectId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('projectId'),
      });
    }
  });

export function updateProposalSchema(_id: string) {
  return z
    .object({
      projectId: optionalRequiredString('projectId'),
      title: optionalRequiredString('title', 255),
      description: nullableString('description'),
      amount: nullableNumber('amount', 0),
      currency: currencyField,
      status: optionalEnum('status', STATUS),
      validUntil: nullableDate('validUntil'),
    })
    .superRefine(async (val, ctx) => {
      if (val.projectId !== undefined && !(await projectExists(val.projectId))) {
        ctx.addIssue({
          path: ['projectId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('projectId'),
        });
      }
    });
}
