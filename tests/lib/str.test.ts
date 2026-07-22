import { describe, expect, it } from 'vitest';
import { snake } from '@/lib/str';

describe('snake', () => {
  it('converts camelCase to snake_case', () => {
    expect(snake('clientId')).toBe('client_id');
    expect(snake('startedAt')).toBe('started_at');
    expect(snake('estimatedHours')).toBe('estimated_hours');
  });

  it('leaves already-lowercase values untouched', () => {
    expect(snake('title')).toBe('title');
    expect(snake('created_at')).toBe('created_at');
  });

  it('handles digits before an uppercase boundary', () => {
    expect(snake('address2Line')).toBe('address2_line');
  });
});
