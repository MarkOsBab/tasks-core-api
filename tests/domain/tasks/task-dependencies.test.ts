import { describe, expect, it, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { taskService } from '@/domain/tasks/task.service';
import { taskResource } from '@/domain/tasks/task.resource';
import type { TaskWithRelations } from '@/domain/tasks/task.types';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

vi.mock('@/domain/notifications/notification.service', () => ({
  notificationService: { notify: vi.fn() },
  buildTaskLink: vi.fn(() => '/board?task=1'),
}));

const prismaMock = prisma as unknown as PrismaMock;

function taskFixture(overrides: Record<string, unknown> = {}): TaskWithRelations {
  return {
    id: 1n,
    columnId: 10n,
    title: 'Card',
    description: null,
    priority: 'medium',
    position: 0,
    dueDate: null,
    createdAt: null,
    createdById: null,
    createdBy: null,
    aiMetadata: null,
    prUrl: null,
    aiDelegable: false,
    estimatedHours: null,
    column: { id: 10n, name: 'Pendiente', boardId: 1n, board: { id: 1n, name: 'Global' } },
    project: null,
    projectId: null,
    assignees: [],
    labels: [],
    timeEntries: [],
    ...overrides,
  } as unknown as TaskWithRelations;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskService.list dependency resolution', () => {
  it('attaches dependsOn in one extra batched query and leaves other cards untouched', async () => {
    const withDeps = taskFixture({
      id: 1n,
      aiMetadata: { dependsOnTaskIds: ['2', '3'] },
    });
    const plain = taskFixture({ id: 4n });
    prismaMock.task.findMany
      .mockResolvedValueOnce([withDeps, plain]) // page
      .mockResolvedValueOnce([
        { id: 2n, title: 'Done dep', column: { isTerminal: true } },
        { id: 3n, title: 'Open dep', column: { isTerminal: false } },
      ]); // batch dependency lookup
    prismaMock.task.count.mockResolvedValue(2);

    const { items } = await taskService.list({}, 1, 50);

    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(2); // page + ONE batch, no N+1
    const depQuery = prismaMock.task.findMany.mock.calls[1][0];
    expect(depQuery.where.id.in).toEqual([2n, 3n]);
    expect(items[0].dependsOn).toEqual([
      { id: 2n, title: 'Done dep', done: true },
      { id: 3n, title: 'Open dep', done: false },
    ]);
    expect(items[1].dependsOn).toBeUndefined();
  });

  it('skips the extra query entirely when no card of the page has dependencies', async () => {
    prismaMock.task.findMany.mockResolvedValueOnce([taskFixture(), taskFixture({ id: 2n })]);
    prismaMock.task.count.mockResolvedValue(2);

    const { items } = await taskService.list({}, 1, 50);

    expect(prismaMock.task.findMany).toHaveBeenCalledTimes(1);
    expect(items.every((task) => task.dependsOn === undefined)).toBe(true);
  });

  it('ignores malformed ids and drops deleted dependencies', async () => {
    const withDeps = taskFixture({
      aiMetadata: { dependsOnTaskIds: ['abc', null, '999', 7] },
    });
    prismaMock.task.findMany
      .mockResolvedValueOnce([withDeps])
      // 999 is soft-deleted (not returned); 7 exists
      .mockResolvedValueOnce([{ id: 7n, title: 'Alive', column: { isTerminal: false } }]);
    prismaMock.task.count.mockResolvedValue(1);

    const { items } = await taskService.list({}, 1, 50);

    const depQuery = prismaMock.task.findMany.mock.calls[1][0];
    expect(depQuery.where.id.in).toEqual([999n, 7n]); // 'abc' and null never reach the query
    expect(items[0].dependsOn).toEqual([{ id: 7n, title: 'Alive', done: false }]);
  });
});

describe('taskResource dependency fields', () => {
  it('serializes dependsOn with string ids and computes blocked', () => {
    const task = taskFixture();
    task.dependsOn = [
      { id: 2n, title: 'Done dep', done: true },
      { id: 3n, title: 'Open dep', done: false },
    ];
    const res = taskResource(task) as Record<string, unknown>;
    expect(res['dependsOn']).toEqual([
      { id: '2', title: 'Done dep', done: true },
      { id: '3', title: 'Open dep', done: false },
    ]);
    expect(res['blocked']).toBe(true);
  });

  it('is not blocked when every dependency is done', () => {
    const task = taskFixture();
    task.dependsOn = [{ id: 2n, title: 'Done dep', done: true }];
    const res = taskResource(task) as Record<string, unknown>;
    expect(res['blocked']).toBe(false);
  });

  it('omits both fields on cards without dependencies (payload unchanged)', () => {
    const bare = taskResource(taskFixture()) as Record<string, unknown>;
    expect('dependsOn' in bare).toBe(false);
    expect('blocked' in bare).toBe(false);

    const emptied = taskFixture();
    emptied.dependsOn = [];
    const res = taskResource(emptied) as Record<string, unknown>;
    expect('dependsOn' in res).toBe(false);
    expect('blocked' in res).toBe(false);
  });
});
