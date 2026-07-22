import { describe, expect, it } from 'vitest';
import { toBigIntOrUndefined } from '@/lib/ids';

describe('toBigIntOrUndefined', () => {
  it('parses numeric strings', () => {
    expect(toBigIntOrUndefined('42')).toBe(42n);
    expect(toBigIntOrUndefined('0')).toBe(0n);
  });

  it('returns undefined on non-numeric input', () => {
    expect(toBigIntOrUndefined('abc')).toBeUndefined();
    expect(toBigIntOrUndefined('1.5')).toBeUndefined();
    expect(toBigIntOrUndefined('')).toBe(0n); // BigInt('') === 0n — documented JS quirk
  });
});
