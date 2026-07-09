import { z } from 'zod';

export const lmsg = {
  required: (a: string) => `The ${a} field is required.`,
  string: (a: string) => `The ${a} field must be a string.`,
  maxString: (a: string, n: number) => `The ${a} field must not be greater than ${n} characters.`,
  selected: (a: string) => `The selected ${a} is invalid.`,
  email: (a: string) => `The ${a} field must be a valid email address.`,
  url: (a: string) => `The ${a} field must be a valid URL.`,
  integer: (a: string) => `The ${a} field must be an integer.`,
  number: (a: string) => `The ${a} field must be a number.`,
  min: (a: string, n: number) => `The ${a} field must be at least ${n}.`,
  max: (a: string, n: number) => `The ${a} field must not be greater than ${n}.`,
  boolean: (a: string) => `The ${a} field must be true or false.`,
  array: (a: string) => `The ${a} field must be an array.`,
  unique: (a: string) => `The ${a} has already been taken.`,
};

/** required|string|max:n */
export function reqString(attr: string, max?: number) {
  const base = z
    .string({ required_error: lmsg.required(attr), invalid_type_error: lmsg.string(attr) })
    .min(1, lmsg.required(attr));
  return max ? base.max(max, lmsg.maxString(attr, max)) : base;
}

/** sometimes|required|string|max:n (for updates) */
export function optionalRequiredString(attr: string, max?: number) {
  const base = z.string({ invalid_type_error: lmsg.string(attr) }).min(1, lmsg.required(attr));
  return (max ? base.max(max, lmsg.maxString(attr, max)) : base).optional();
}

/** nullable|string|max:n */
export function nullableString(attr: string, max?: number) {
  const base = z.string({ invalid_type_error: lmsg.string(attr) });
  return (max ? base.max(max, lmsg.maxString(attr, max)) : base).nullable().optional();
}

/** sometimes|string|max:n */
export function optionalString(attr: string, max?: number) {
  const base = z.string({ invalid_type_error: lmsg.string(attr) });
  return (max ? base.max(max, lmsg.maxString(attr, max)) : base).optional();
}

function enumErrorMap(attr: string): z.ZodErrorMap {
  return (issue) => {
    if (issue.code === z.ZodIssueCode.invalid_type) {
      return { message: lmsg.required(attr) };
    }
    return { message: lmsg.selected(attr) };
  };
}

export function reqEnum<T extends readonly [string, ...string[]]>(attr: string, values: T) {
  return z.enum(values, { errorMap: enumErrorMap(attr) });
}

export function optionalEnum<T extends readonly [string, ...string[]]>(attr: string, values: T) {
  return z.enum(values, { errorMap: enumErrorMap(attr) }).optional();
}

export function nullableEnum<T extends readonly [string, ...string[]]>(attr: string, values: T) {
  return z.enum(values, { errorMap: () => ({ message: lmsg.selected(attr) }) }).nullable().optional();
}

export function nullableInt(attr: string, min = 0) {
  return z.number({ invalid_type_error: lmsg.integer(attr) })
    .int(lmsg.integer(attr)).min(min, lmsg.min(attr, min)).nullable().optional();
}

export function nullableIntRange(attr: string, min: number, max: number) {
  return z.number({ invalid_type_error: lmsg.integer(attr) })
    .int(lmsg.integer(attr)).min(min, lmsg.min(attr, min)).max(max, lmsg.max(attr, max))
    .nullable().optional();
}

export function nullableNumber(attr: string, min?: number) {
  const base = z.number({ invalid_type_error: lmsg.number(attr) });
  return (min !== undefined ? base.min(min, lmsg.min(attr, min)) : base).nullable().optional();
}

export function nullableBool(attr: string) {
  return z.boolean({ invalid_type_error: lmsg.boolean(attr) }).nullable().optional();
}

/** nullable|hex color (#rrggbb) */
export function nullableHexColor(attr: string) {
  return z
    .string({ invalid_type_error: lmsg.string(attr) })
    .regex(/^#[0-9a-fA-F]{6}$/, `The ${attr} field must be a valid hex color.`)
    .nullable()
    .optional();
}

export function nullableEmail(attr: string) {
  return z.string({ invalid_type_error: lmsg.string(attr) })
    .email(lmsg.email(attr)).nullable().optional();
}

/** nullable|url|max:n */
export function nullableUrl(attr: string, max?: number) {
  const base = z.string({ invalid_type_error: lmsg.string(attr) }).url(lmsg.url(attr));
  return (max ? base.max(max, lmsg.maxString(attr, max)) : base).nullable().optional();
}
