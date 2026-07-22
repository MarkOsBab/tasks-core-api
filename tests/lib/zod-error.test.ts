import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodToHttpError } from '@/lib/zod-error';

describe('zodToHttpError', () => {
  it('maps issues into the Laravel-style 422 shape', () => {
    const schema = z.object({
      email: z.string({ required_error: 'The email field is required.' }),
      title: z.string().min(1, 'The title field is required.'),
    });
    const result = schema.safeParse({ title: '' });
    if (result.success) throw new Error('expected failure');

    const err = zodToHttpError(result.error);
    expect(err.status).toBe(422);
    expect(err.message).toBe('The email field is required.');
    expect(err.body).toEqual({
      message: 'The email field is required.',
      errors: {
        email: ['The email field is required.'],
        title: ['The title field is required.'],
      },
    });
  });

  it('joins nested paths with dots and uses "_" for root issues', () => {
    const nested = z.object({ user: z.object({ name: z.string().min(1, 'name required') }) });
    const nestedResult = nested.safeParse({ user: { name: '' } });
    if (nestedResult.success) throw new Error('expected failure');
    expect(zodToHttpError(nestedResult.error).errors).toEqual({ 'user.name': ['name required'] });

    const root = z.string().safeParse(5);
    if (root.success) throw new Error('expected failure');
    expect(Object.keys(zodToHttpError(root.error).errors ?? {})).toEqual(['_']);
  });
});
