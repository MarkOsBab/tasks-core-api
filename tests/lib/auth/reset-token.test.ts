import { describe, expect, it } from 'vitest';
import { generateResetToken, hashResetToken } from '@/lib/auth/reset-token';

describe('generateResetToken', () => {
  it('produces a 64-hex-char token, different every time', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('hashResetToken', () => {
  it('is a deterministic sha256 hex digest', () => {
    expect(hashResetToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hashResetToken('abc')).toBe(hashResetToken('abc'));
    expect(hashResetToken('abc')).not.toBe(hashResetToken('abd'));
  });
});
