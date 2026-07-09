import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { rawExists } from '@/lib/prisma';
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

export const storeUserSchema = z
  .object({
    name: reqString('name', 255),
    lastName: nullableString('lastName', 255),
    email: reqString('email', 255).email(lmsg.email('email')),
    password: reqString('password').min(PASSWORD_MIN, passwordMinMsg),
    image: nullableString('image', 2048),
  })
  .superRefine(uniqueEmail());

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
    })
    .superRefine(uniqueEmail(toBigIntOrUndefined(id)));
}
