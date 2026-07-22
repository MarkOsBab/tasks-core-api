import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshToken, signToken, verifyToken } from '@/lib/auth/jwt';

// Time-sensitive specs use fake timers (jose reads `Date`), so TTLs are exercised
// deterministically without waiting.

afterEach(() => {
  vi.useRealTimers();
});

describe('signToken / verifyToken', () => {
  it('round-trips the subject as a string', async () => {
    const issued = await signToken(42n);
    const { sub } = await verifyToken(issued.token);
    expect(sub).toBe('42');
    expect(issued.expiresIn).toBe(60 * 60); // JWT_TTL default: 60 minutes
  });

  it('rejects a token signed with another secret', async () => {
    const { token } = await signToken('1');
    vi.stubEnv('JWT_SECRET', 'a-different-secret');
    await expect(verifyToken(token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { token } = await signToken('1');
    vi.setSystemTime(new Date('2026-01-01T01:01:00Z')); // past the 60 min TTL
    await expect(verifyToken(token)).rejects.toThrow();
  });
});

describe('refreshToken', () => {
  it('re-signs preserving the original iat (non-sliding window)', async () => {
    vi.useFakeTimers();
    const firstLogin = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(firstLogin);
    const { token } = await signToken('7');

    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    const refreshed = await refreshToken(token);
    const { sub } = await verifyToken(refreshed.token);
    expect(sub).toBe('7');

    const payload = JSON.parse(
      Buffer.from(refreshed.token.split('.')[1], 'base64url').toString('utf8'),
    );
    expect(payload.iat).toBe(Math.floor(firstLogin.getTime() / 1000));
  });

  it('works on an already-expired token while inside the refresh window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { token } = await signToken('7');
    vi.setSystemTime(new Date('2026-01-01T03:00:00Z')); // token expired, window still open
    await expect(refreshToken(token)).resolves.toMatchObject({ expiresIn: 3600 });
  });

  it('rejects once the refresh window anchored to iat is over', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const { token } = await signToken('7');
    vi.setSystemTime(new Date('2026-01-16T00:01:00Z')); // JWT_REFRESH_TTL default: 14 days
    await expect(refreshToken(token)).rejects.toThrow('Refresh window expired');
  });

  it('rejects a token with an invalid signature', async () => {
    await expect(refreshToken('not-a-jwt')).rejects.toThrow('Invalid token signature');
  });
});
