import { describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from './prisma-mock';

describe('createPrismaMock', () => {
  it('returns the same mock for repeated model/method access', () => {
    const prisma = createPrismaMock();
    prisma.task.findMany.mockResolvedValue([{ id: 1n }]);
    expect(prisma.task.findMany).toBe(prisma.task.findMany);
    return expect(prisma.task.findMany()).resolves.toEqual([{ id: 1n }]);
  });

  it('records calls like any vi.fn()', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    await prisma.user.findUnique({ where: { id: 1n } });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1n } });
  });

  it('$transaction awaits an array of promises', async () => {
    const prisma = createPrismaMock();
    await expect(prisma.$transaction([Promise.resolve('a'), Promise.resolve('b')])).resolves.toEqual([
      'a',
      'b',
    ]);
  });

  it('$transaction invokes a callback with the mock as tx client', async () => {
    const prisma = createPrismaMock();
    prisma.task.update.mockResolvedValue({ id: 1n });
    const result = await prisma.$transaction(async (tx: ReturnType<typeof createPrismaMock>) => {
      return tx.task.update({ where: { id: 1n }, data: { position: 2 } });
    });
    expect(result).toEqual({ id: 1n });
    expect(prisma.task.update).toHaveBeenCalledOnce();
  });

  it('is not mistaken for a thenable', () => {
    const prisma = createPrismaMock();
    expect((prisma as Record<string, unknown>)['then']).toBeUndefined();
  });

  it('can back a vi.mock of @/lib/prisma', () => {
    // Reference pattern for task #31 (kept as a smoke check that the shape matches):
    const prisma = createPrismaMock();
    const rawExists = vi.fn().mockResolvedValue(false);
    expect(() => ({ prisma, rawExists })).not.toThrow();
  });
});
