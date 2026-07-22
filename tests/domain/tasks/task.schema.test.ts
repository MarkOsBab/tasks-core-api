import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  moveTaskSchema,
  parseDateInput,
  storeTaskSchema,
  updateTaskSchema,
} from '@/domain/tasks/task.schema';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

const prismaMock = prisma as unknown as PrismaMock;

function messagesFor(error: z.ZodError, field: string): string[] {
  return error.issues.filter((issue) => issue.path.join('.') === field).map((i) => i.message);
}

beforeEach(() => {
  // Existence checks hit (mocked) Prisma: default every referenced id to "exists".
  prismaMock.boardColumn.findFirst.mockResolvedValue({ id: 1n });
  prismaMock.project.findFirst.mockResolvedValue({ id: 1n });
  prismaMock.user.findFirst.mockResolvedValue({ id: 1n });
});

describe('parseDateInput', () => {
  it('parses d/m/Y and ISO into UTC midnight', () => {
    expect(parseDateInput('15/08/2026')).toEqual(new Date(Date.UTC(2026, 7, 15)));
    expect(parseDateInput('2026-08-15')).toEqual(new Date(Date.UTC(2026, 7, 15)));
  });

  it('rejects impossible and malformed dates', () => {
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('2026-02-31')).toBeNull();
    expect(parseDateInput('yesterday')).toBeNull();
  });
});

describe('storeTaskSchema', () => {
  const valid = { columnId: '10', title: 'Fix login' };

  it('accepts a minimal task and defaults priority to medium', async () => {
    const parsed = await storeTaskSchema.parseAsync(valid);
    expect(parsed.priority).toBe('medium');
  });

  it('requires columnId and title', async () => {
    const result = await storeTaskSchema.safeParseAsync({});
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'columnId')).toContain('The columnId field is required.');
    expect(messagesFor(result.error, 'title')).toContain('The title field is required.');
  });

  it('rejects an unknown priority', async () => {
    const result = await storeTaskSchema.safeParseAsync({ ...valid, priority: 'blocker' });
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'priority')).toContain('The selected priority is invalid.');
  });

  it('rejects a columnId that does not exist', async () => {
    prismaMock.boardColumn.findFirst.mockResolvedValue(null);
    const result = await storeTaskSchema.safeParseAsync(valid);
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'columnId')).toContain('The selected columnId is invalid.');
  });

  it('rejects a soft-deleted project tag', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    const result = await storeTaskSchema.safeParseAsync({ ...valid, projectId: '5' });
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'projectId')).toContain('The selected projectId is invalid.');
  });

  it('fails the whole assignee array on a single unknown user', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 1n }).mockResolvedValueOnce(null);
    const result = await storeTaskSchema.safeParseAsync({ ...valid, assigneeIds: ['1', '999'] });
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'assigneeIds')).toContain(
      'The selected assigneeIds is invalid.',
    );
  });

  it('rejects an invalid dueDate', async () => {
    const result = await storeTaskSchema.safeParseAsync({ ...valid, dueDate: '99/99/2026' });
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'dueDate')).toContain(
      'The dueDate field must be a valid date.',
    );
  });
});

describe('updateTaskSchema', () => {
  it('lets every field be absent (partial update)', async () => {
    const result = await updateTaskSchema('1').safeParseAsync({});
    expect(result.success).toBe(true);
  });

  it('still validates present fields', async () => {
    prismaMock.boardColumn.findFirst.mockResolvedValue(null);
    const result = await updateTaskSchema('1').safeParseAsync({ columnId: '999', title: '' });
    if (result.success) throw new Error('expected failure');
    expect(messagesFor(result.error, 'columnId')).toContain('The selected columnId is invalid.');
    expect(messagesFor(result.error, 'title')).toContain('The title field is required.');
  });
});

describe('moveTaskSchema', () => {
  it('requires an integer position >= 0', async () => {
    const missing = await moveTaskSchema.safeParseAsync({ columnId: '10' });
    if (missing.success) throw new Error('expected failure');
    expect(messagesFor(missing.error, 'position')).toContain('The position field is required.');

    const negative = await moveTaskSchema.safeParseAsync({ columnId: '10', position: -1 });
    if (negative.success) throw new Error('expected failure');
    expect(messagesFor(negative.error, 'position')).toContain(
      'The position field must be at least 0.',
    );

    expect((await moveTaskSchema.safeParseAsync({ columnId: '10', position: 0 })).success).toBe(
      true,
    );
  });
});
