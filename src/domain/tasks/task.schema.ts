import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import {
  lmsg,
  nullableBool,
  nullableInt,
  nullableNumber,
  nullableString,
  optionalEnum,
  optionalRequiredString,
  reqEnum,
  reqString,
} from '@/lib/validation';

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

// Prisma read (not rawExists) so columns of soft-deleted projects are still selectable
// (a project board's columns live on; the extension only filters the Task/Project reads).
async function columnExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const column = await prisma.boardColumn.findFirst({ where: { id: bigId }, select: { id: true } });
  return column !== null;
}

// Soft-delete-aware (extension filters findFirst): trashed projects are not valid tags.
async function projectExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const project = await prisma.project.findFirst({ where: { id: bigId }, select: { id: true } });
  return project !== null;
}

async function userExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  // findFirst (not findUnique) so the soft-delete extension hides deleted users.
  const user = await prisma.user.findFirst({ where: { id: bigId }, select: { id: true } });
  return user !== null;
}

// Every assignee id must resolve to a live user; a single bad id fails the whole array.
async function assertAssigneesExist(
  ids: string[] | null | undefined,
  ctx: z.RefinementCtx,
): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const results = await Promise.all(ids.map((id) => userExists(id)));
  if (results.some((exists) => !exists)) {
    ctx.addIssue({
      path: ['assigneeIds'],
      code: z.ZodIssueCode.custom,
      message: lmsg.selected('assigneeIds'),
    });
  }
}

export const storeTaskSchema = z
  .object({
    columnId: reqString('columnId'),
    // Only honored on the global board (project boards derive it from the column); tags the
    // card with a project/client so it can be told apart visually.
    projectId: nullableString('projectId'),
    title: reqString('title', 255),
    description: nullableString('description'),
    priority: reqEnum('priority', TASK_PRIORITY).default('medium'),
    position: nullableInt('position', 0),
    dueDate: nullableDate('dueDate'),
    estimatedHours: nullableNumber('estimatedHours', 0),
    aiDelegable: nullableBool('aiDelegable'),
    assigneeIds: z.array(z.string()).nullable().optional(),
    labelIds: z.array(z.string()).nullable().optional(),
  })
  .superRefine(async (val, ctx) => {
    if (!(await columnExists(val.columnId))) {
      ctx.addIssue({
        path: ['columnId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('columnId'),
      });
    }
    if (val.projectId != null && val.projectId !== '' && !(await projectExists(val.projectId))) {
      ctx.addIssue({
        path: ['projectId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('projectId'),
      });
    }
    await assertAssigneesExist(val.assigneeIds, ctx);
  });

// Factory to match the updateHandler contract; tasks have no unique checks so id is unused.
export function updateTaskSchema(_id: string) {
  return z
    .object({
      columnId: optionalRequiredString('columnId'),
      projectId: nullableString('projectId'),
      title: optionalRequiredString('title', 255),
      description: nullableString('description'),
      priority: optionalEnum('priority', TASK_PRIORITY),
      position: nullableInt('position', 0),
      dueDate: nullableDate('dueDate'),
      estimatedHours: nullableNumber('estimatedHours', 0),
      aiDelegable: nullableBool('aiDelegable'),
      assigneeIds: z.array(z.string()).nullable().optional(),
      labelIds: z.array(z.string()).nullable().optional(),
    })
    .superRefine(async (val, ctx) => {
      if (val.columnId !== undefined && !(await columnExists(val.columnId))) {
        ctx.addIssue({
          path: ['columnId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('columnId'),
        });
      }
      if (val.projectId != null && val.projectId !== '' && !(await projectExists(val.projectId))) {
        ctx.addIssue({
          path: ['projectId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('projectId'),
        });
      }
      await assertAssigneesExist(val.assigneeIds, ctx);
    });
}

export const moveTaskSchema = z
  .object({
    columnId: reqString('columnId'),
    position: z
      .number({
        required_error: lmsg.required('position'),
        invalid_type_error: lmsg.integer('position'),
      })
      .int(lmsg.integer('position'))
      .min(0, lmsg.min('position', 0)),
  })
  .superRefine(async (val, ctx) => {
    if (!(await columnExists(val.columnId))) {
      ctx.addIssue({
        path: ['columnId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('columnId'),
      });
    }
  });
