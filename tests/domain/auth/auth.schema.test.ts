import { describe, expect, it } from 'vitest';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '@/domain/auth/auth.schema';

describe('loginSchema', () => {
  it('requires both fields with Laravel-style messages', () => {
    const result = loginSchema.safeParse({});
    if (result.success) throw new Error('expected failure');
    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toContain('The email field is required.');
    expect(messages).toContain('The password field is required.');
  });

  it('rejects an invalid email address', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' });
    if (result.success) throw new Error('expected failure');
    expect(result.error.issues[0]?.message).toBe('The email field must be a valid email address.');
  });

  it('accepts valid credentials input', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true);
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('requires a token and a password of at least 8 characters', () => {
    const short = resetPasswordSchema.safeParse({ token: 'tok', password: '1234567' });
    if (short.success) throw new Error('expected failure');
    expect(short.error.issues[0]?.message).toBe(
      'The password field must be at least 8 characters.',
    );

    expect(resetPasswordSchema.safeParse({ token: '', password: '12345678' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 'tok', password: '12345678' }).success).toBe(
      true,
    );
  });
});
