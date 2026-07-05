import type { ZodError } from 'zod';
import { HttpError } from './http-error';

export function zodToHttpError(err: ZodError): HttpError {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const field = issue.path.length ? issue.path.join('.') : '_';
    (errors[field] ??= []).push(issue.message);
  }
  const message = err.issues[0]?.message ?? 'The given data was invalid.';
  return new HttpError(422, message, errors);
}
