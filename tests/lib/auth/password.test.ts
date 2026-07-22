import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a password against its own hash', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword('secret123', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('secret123');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('verifies Laravel-style $2y$ hashes', async () => {
    // bcryptjs treats $2y$ as $2b$; hash of "password" (the seed admin credential format).
    const laravelHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    await expect(verifyPassword('password', laravelHash)).resolves.toBe(true);
  });
});
