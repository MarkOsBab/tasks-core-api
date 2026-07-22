import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { taskRepository } from '@/domain/tasks/task.repository';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

const prismaMock = prisma as unknown as PrismaMock;

beforeEach(() => {
  prismaMock.task.findMany.mockResolvedValue([]);
  prismaMock.task.count.mockResolvedValue(0);
});

describe('paginate filters', () => {
  it('maps camelCase filters into the Prisma where', async () => {
    await taskRepository.paginate(
      {
        projectId: '5',
        clientId: '3',
        priority: 'high',
        assigneeIds: '1,2,junk',
        labelIds: '7',
        search: 'login',
      },
      2,
      10,
    );

    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.AND[0]).toEqual({
      projectId: 5n,
      project: { clientId: 3n },
      priority: 'high',
      assignees: { some: { id: { in: [1n, 2n] } } }, // junk ids dropped
      labels: { some: { id: { in: [7n] } } },
    });
    expect(args.where.AND[1]).toEqual({
      OR: [{ title: { contains: 'login', mode: 'insensitive' } }],
    });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(prismaMock.task.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('scopes ?boardId through the column relation', async () => {
    await taskRepository.paginate({ boardId: '1' }, 1, 25);
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where.AND[0]).toEqual({ column: { boardId: 1n } });
  });

  it('ignores empty and non-numeric filter values', async () => {
    await taskRepository.paginate({ projectId: '', columnId: 'abc' }, 1, 25);
    const args = prismaMock.task.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
  });
});

describe('paginate ordering', () => {
  it('honors whitelisted sort[field] params', async () => {
    await taskRepository.paginate({ 'sort[dueDate]': 'desc' }, 1, 25);
    expect(prismaMock.task.findMany.mock.calls[0][0].orderBy).toEqual({ dueDate: 'desc' });
  });

  it('ignores non-whitelisted sort fields', async () => {
    await taskRepository.paginate({ 'sort[password]': 'asc' }, 1, 25);
    expect(prismaMock.task.findMany.mock.calls[0][0].orderBy).toEqual({ id: 'desc' });
  });

  it('falls back to kanban position when scoped to a board', async () => {
    await taskRepository.paginate({ boardId: '1' }, 1, 25);
    expect(prismaMock.task.findMany.mock.calls[0][0].orderBy).toEqual([
      { position: 'asc' },
      { id: 'desc' },
    ]);
  });
});

describe('find', () => {
  it('returns null for a non-numeric id (-> 404) without querying', async () => {
    await expect(taskRepository.find('abc')).resolves.toBeNull();
    expect(prismaMock.task.findFirst).not.toHaveBeenCalled();
  });
});

describe('selectOptions', () => {
  it('builds the flat select query (take 50, title asc, ?q insensitive)', async () => {
    await taskRepository.selectOptions('log', '5', '1');
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 5n,
        column: { boardId: 1n },
        title: { contains: 'log', mode: 'insensitive' },
      },
      orderBy: { title: 'asc' },
      take: 50,
    });
  });
});
