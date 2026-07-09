import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import { lmsg, nullableString, optionalRequiredString, reqString } from '@/lib/validation';

// d/m/Y H:i[:s] (UI format, time optional) — same UTC semantics as the d/m/Y date inputs.
const DMY_HMS_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
// ISO Y-m-d[ H:i[:s]] / Y-m-dTH:i[:s], tolerating Date.toJSON extras (.mmm and Z)
const ISO_HMS_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?Z?)?$/;

function utcDateTime(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
): Date | null {
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

/** Accepts d/m/Y H:i[:s] (UI format) or ISO; time defaults to 00:00:00. UTC, matching dmyHms. */
export function parseDateTimeInput(value: string): Date | null {
  const dmy = DMY_HMS_PATTERN.exec(value);
  if (dmy) {
    return utcDateTime(
      Number(dmy[3]),
      Number(dmy[2]),
      Number(dmy[1]),
      Number(dmy[4] ?? 0),
      Number(dmy[5] ?? 0),
      Number(dmy[6] ?? 0),
    );
  }
  const iso = ISO_HMS_PATTERN.exec(value);
  if (iso) {
    return utcDateTime(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    );
  }
  return null;
}

const invalidDateTime = (attr: string) => `The ${attr} field must be a valid date.`;

function reqDateTime(attr: string) {
  return z
    .string({ required_error: lmsg.required(attr), invalid_type_error: lmsg.string(attr) })
    .refine((value) => parseDateTimeInput(value) !== null, { message: invalidDateTime(attr) });
}

function optionalRequiredDateTime(attr: string) {
  return z
    .string({ invalid_type_error: lmsg.string(attr) })
    .refine((value) => parseDateTimeInput(value) !== null, { message: invalidDateTime(attr) })
    .optional();
}

function nullableDateTime(attr: string) {
  return z
    .string({ invalid_type_error: lmsg.string(attr) })
    .refine((value) => parseDateTimeInput(value) !== null, { message: invalidDateTime(attr) })
    .nullable()
    .optional();
}

// Goes through the extended client so soft-deleted tasks are NOT valid targets.
async function taskExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const task = await prisma.task.findFirst({ where: { id: bigId }, select: { id: true } });
  return task !== null;
}

const END_AFTER_START = 'The endedAt field must be a date after startedAt.';

function checkRange(
  ctx: z.RefinementCtx,
  startedAt: string | undefined,
  endedAt: string | null | undefined,
) {
  if (startedAt == null || endedAt == null) return;
  const start = parseDateTimeInput(startedAt);
  const end = parseDateTimeInput(endedAt);
  if (start && end && end.getTime() <= start.getTime()) {
    ctx.addIssue({ path: ['endedAt'], code: z.ZodIssueCode.custom, message: END_AFTER_START });
  }
}

export const storeTimeEntrySchema = z
  .object({
    taskId: reqString('taskId'),
    description: nullableString('description', 1000),
    startedAt: reqDateTime('startedAt'),
    endedAt: nullableDateTime('endedAt'),
  })
  .superRefine(async (val, ctx) => {
    if (!(await taskExists(val.taskId))) {
      ctx.addIssue({
        path: ['taskId'],
        code: z.ZodIssueCode.custom,
        message: lmsg.selected('taskId'),
      });
    }
    checkRange(ctx, val.startedAt, val.endedAt);
  });

// Factory to match the updateHandler contract; time entries have no unique checks so id is unused.
export function updateTimeEntrySchema(_id: string) {
  return z
    .object({
      taskId: optionalRequiredString('taskId'),
      description: nullableString('description', 1000),
      startedAt: optionalRequiredDateTime('startedAt'),
      endedAt: nullableDateTime('endedAt'),
    })
    .superRefine(async (val, ctx) => {
      if (val.taskId !== undefined && !(await taskExists(val.taskId))) {
        ctx.addIssue({
          path: ['taskId'],
          code: z.ZodIssueCode.custom,
          message: lmsg.selected('taskId'),
        });
      }
      checkRange(ctx, val.startedAt, val.endedAt);
    });
}

// Body of POST /api/tasks/{id}/time/start (whole body optional).
export const startTimerSchema = z.object({
  description: nullableString('description', 1000),
});
