import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import {
  lmsg,
  nullableInt,
  nullableString,
  optionalEnum,
  optionalRequiredString,
  reqEnum,
  reqString,
} from '@/lib/validation';

export const TASK_STATUS = ['todo', 'in_progress', 'review', 'done'] as const;
export const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

const DMY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

/** Accepts d/m/Y (UI format) or ISO Y-m-d; returns a UTC-midnight Date for @db.Date columns. */
export function parseDateInput(value: string): Date | null {
  const dmy = DMY_PATTERN.exec(value);
  if (dmy) return utcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  const iso = ISO_PATTERN.exec(value);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return null;
}

function nullableDate(attr: string) {
  return z
    .string({ invalid_type_error: lmsg.string(attr) })
    .refine((value) => parseDateInput(value) !== null, {
      message: `The ${attr} field must be a valid date.`,
    })
    .nullable()
    .optional();
}

// Prisma read (not rawExists) so soft-deleted projects are not selectable.
async function projectExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const project = await prisma.project.findFirst({ where: { id: bigId }, select: { id: true } });
  return project !== null;
}

async function userExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const user = await prisma.user.findUnique({ where: { id: bigId }, select: { id: true } });
  return user !== null;
}

export const storeTaskSchema = z
  .object({
    projectId: reqString('projectId'),
    title: reqString('title', 255),
    description: nullableString('description'),
    status: reqEnum('status', TASK_STATUS).default('todo'),
    priority: reqEnum('priority', TASK_PRIORITY).default('medium'),
    position: nullableInt('position', 0),
    dueDate: nullableDate('dueDate'),
    assigneeId: nullableString('assigneeId'),
  })
  .superRefine(async (val, ctx) => {
    if (!(await projectExists(val.projectId))) {
      ctx.addIssue({
        path: ['projectId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('projectId'),
      });
    }
    if (val.assigneeId != null && val.assigneeId !== '' && !(await userExists(val.assigneeId))) {
      ctx.addIssue({
        path: ['assigneeId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('assigneeId'),
      });
    }
  });

// Factory to match the updateHandler contract; tasks have no unique checks so id is unused.
export function updateTaskSchema(_id: string) {
  return z
    .object({
      projectId: optionalRequiredString('projectId'),
      title: optionalRequiredString('title', 255),
      description: nullableString('description'),
      status: optionalEnum('status', TASK_STATUS),
      priority: optionalEnum('priority', TASK_PRIORITY),
      position: nullableInt('position', 0),
      dueDate: nullableDate('dueDate'),
      assigneeId: nullableString('assigneeId'),
    })
    .superRefine(async (val, ctx) => {
      if (val.projectId !== undefined && !(await projectExists(val.projectId))) {
        ctx.addIssue({
          path: ['projectId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('projectId'),
        });
      }
      if (val.assigneeId != null && val.assigneeId !== '' && !(await userExists(val.assigneeId))) {
        ctx.addIssue({
          path: ['assigneeId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('assigneeId'),
        });
      }
    });
}

export const moveTaskSchema = z.object({
  status: reqEnum('status', TASK_STATUS),
  position: z
    .number({
      required_error: lmsg.required('position'),
      invalid_type_error: lmsg.integer('position'),
    })
    .int(lmsg.integer('position'))
    .min(0, lmsg.min('position', 0)),
});
