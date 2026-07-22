import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

const prismaMock = prisma as unknown as PrismaMock;
const NOW = new Date('2026-07-22T12:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('createForUser (manual timesheet entry)', () => {
  it('parses datetimes, owns the row and keeps durationSeconds in sync', async () => {
    prismaMock.timeEntry.create.mockResolvedValue({ id: 1n });
    await timeEntryService.createForUser(9n, {
      taskId: '7',
      startedAt: '22/07/2026 10:00:00',
      endedAt: '2026-07-22T11:30:00',
    });
    const args = prismaMock.timeEntry.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      taskId: 7n,
      userId: 9n,
      startedAt: new Date('2026-07-22T10:00:00Z'),
      endedAt: new Date('2026-07-22T11:30:00Z'),
      durationSeconds: 5400,
    });
  });

  it('422s when endedAt is not after startedAt', async () => {
    await expect(
      timeEntryService.createForUser(9n, {
        taskId: '7',
        startedAt: '22/07/2026 10:00:00',
        endedAt: '22/07/2026 10:00:00',
      }),
    ).rejects.toMatchObject({
      status: 422,
      errors: { endedAt: ['The endedAt field must be a date after startedAt.'] },
    });
    expect(prismaMock.timeEntry.create).not.toHaveBeenCalled();
  });
});

describe('start', () => {
  it('auto-closes every running timer of the user, stamping their durations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const running = {
      id: 50n,
      startedAt: new Date(NOW.getTime() - 100_000), // 100s ago
    };
    prismaMock.timeEntry.findMany.mockResolvedValue([running]);
    prismaMock.timeEntry.create.mockResolvedValue({ id: 51n });

    await timeEntryService.start(9n, 7n, 'working on it');

    expect(prismaMock.timeEntry.findMany).toHaveBeenCalledWith({
      where: { userId: 9n, endedAt: null, deletedAt: null },
    });
    expect(prismaMock.timeEntry.update).toHaveBeenCalledWith({
      where: { id: 50n },
      data: { endedAt: NOW, durationSeconds: 100 },
    });
    const createArgs = prismaMock.timeEntry.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      taskId: 7n,
      userId: 9n,
      startedAt: NOW,
      description: 'working on it',
    });
  });
});

describe('stop', () => {
  it('returns null when nothing is running (normal outcome, not an error)', async () => {
    prismaMock.timeEntry.findFirst.mockResolvedValue(null);
    await expect(timeEntryService.stop(9n, 7n)).resolves.toBeNull();
    expect(prismaMock.timeEntry.update).not.toHaveBeenCalled();
  });

  it('closes the running entry computing its duration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prismaMock.timeEntry.findFirst.mockResolvedValue({
      id: 60n,
      startedAt: new Date(NOW.getTime() - 90_000),
    });
    prismaMock.timeEntry.update.mockResolvedValue({ id: 60n });

    await timeEntryService.stop(9n, 7n);

    expect(prismaMock.timeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 60n },
        data: { endedAt: NOW, durationSeconds: 90 },
      }),
    );
  });
});
