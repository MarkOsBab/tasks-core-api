import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma, rawExists } from '@/lib/prisma';
import { lmsg, nullableString, optionalRequiredString, reqString } from '@/lib/validation';

const PASSWORD_MIN = 8;
const passwordMinMsg = `The password field must be at least ${PASSWORD_MIN} characters.`;

function uniqueEmail(exceptId?: bigint) {
  return async (val: { email?: string }, ctx: z.RefinementCtx) => {
    if (!val.email) return;
    if (await rawExists('users', 'email', val.email, exceptId)) {
      ctx.addIssue({ path: ['email'], code: z.ZodIssueCode.custom, message: lmsg.unique('email') });
    }
  };
}

// Every referenced project must resolve to a live row (soft-deleted ones are filtered by the
// extension); a single bad id fails the whole array.
async function assertProjectsExist(
  ids: string[] | null | undefined,
  ctx: z.RefinementCtx,
): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const bigIds = [...new Set(ids)]
    .map((id) => toBigIntOrUndefined(id))
    .filter((id): id is bigint => id !== undefined);
  const found = await prisma.project.findMany({
    where: { id: { in: bigIds } },
    select: { id: true },
  });
  if (found.length !== bigIds.length || bigIds.length !== new Set(ids).size) {
    ctx.addIssue({
      path: ['projectIds'],
      code: z.ZodIssueCode.custom,
      message: lmsg.selected('projectIds'),
    });
  }
}

// No password on create: the user gets an invite email with a set-password link instead
// (see UserService.create → passwordResetService.sendInvite).
export const storeUserSchema = z
  .object({
    name: reqString('name', 255),
    lastName: nullableString('lastName', 255),
    email: reqString('email', 255).email(lmsg.email('email')),
    image: nullableString('image', 2048),
    role: nullableString('role', 255),
    projectIds: z.array(z.string()).nullable().optional(),
  })
  .superRefine(uniqueEmail())
  .superRefine(async (val, ctx) => assertProjectsExist(val.projectIds, ctx));

export function updateUserSchema(id: string) {
  return z
    .object({
      name: optionalRequiredString('name', 255),
      lastName: nullableString('lastName', 255),
      email: z
        .string({ invalid_type_error: lmsg.string('email') })
        .min(1, lmsg.required('email'))
        .max(255, lmsg.maxString('email', 255))
        .email(lmsg.email('email'))
        .optional(),
      // '' / null = "don't change it"; the service drops the absent key.
      password: z.preprocess(
        (value) => (value === '' || value === null ? undefined : value),
        z
          .string({ invalid_type_error: lmsg.string('password') })
          .min(PASSWORD_MIN, passwordMinMsg)
          .optional(),
      ),
      image: nullableString('image', 2048),
      role: nullableString('role', 255),
      projectIds: z.array(z.string()).nullable().optional(),
    })
    .superRefine(uniqueEmail(toBigIntOrUndefined(id)))
    .superRefine(async (val, ctx) => assertProjectsExist(val.projectIds, ctx));
}
