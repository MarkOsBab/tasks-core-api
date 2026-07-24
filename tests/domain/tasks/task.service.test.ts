import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/domain/notifications/notification.service';
import { taskService } from '@/domain/tasks/task.service';
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
const notifyMock = notificationService.notify as unknown as ReturnType<typeof vi.fn>;

const globalColumn = { id: 10n, wipLimit: null, board: { id: 1n, projectId: null } };

function taskFixture(overrides: Record<string, unknown> = {}): TaskWithRelations {
  return {
    id: 1n,
    title: 'Card',
    columnId: 10n,
    position: 2,
    projectId: 5n,
    column: { id: 10n, boardId: 1n, board: { id: 1n, projectId: null } },
    assignees: [],
    labels: [],
    timeEntries: [],
    ...overrides,
  } as unknown as TaskWithRelations;
}

describe('create', () => {
  it('prepares ids, stamps the creator, resolves position and notifies new assignees', async () => {
    prismaMock.boardColumn.findUnique.mockResolvedValue(globalColumn);
    prismaMock.task.count.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
    const created = taskFixture({
      assignees: [{ id: 4n, name: 'Ana', lastName: null, deletedAt: null }],
    });
    prismaMock.task.create.mockResolvedValue(created);
    prismaMock.user.findUnique.mockResolvedValue({ name: 'Marcos', lastName: 'García' });

    await taskService.create(
      {
        columnId: '10',
        projectId: '5',
        title: 'Card',
        priority: 'high',
        position: null,
        dueDate: '15/08/2026',
        assigneeIds: ['4', 'not-an-id'],
        labelIds: ['2'],
      },
      { id: 9n },
    );

    const args = prismaMock.task.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      columnId: 10n,
      projectId: 5n, // global board: the explicit tag wins
      createdById: 9n,
      priority: 'high',
      position: 3, // lands at the end of the target column
      dueDate: new Date(Date.UTC(2026, 7, 15)),
      assignees: { connect: [{ id: 4n }] }, // invalid ids silently dropped
      labels: { connect: [{ id: 2n }] },
    });
    expect(args.data).not.toHaveProperty('assigneeIds');

    // The newly-added assignee is notified; the actor never notifies themselves.
    expect(notifyMock).toHaveBeenCalledOnce();
    expect(notifyMock.mock.calls[0][0]).toMatchObject({
      userId: 4n,
      type: 'task_assigned',
      actorId: 9n,
      actorName: 'Marcos García',
    });
  });

  it('respects the WIP limit of the target column', async () => {
    prismaMock.boardColumn.findUnique.mockResolvedValue({ ...globalColumn, wipLimit: 2 });
    prismaMock.task.count.mockResolvedValue(2); // column already full
    await expect(
      taskService.create({ columnId: '10', title: 'Card', priority: 'low' }, { id: 9n }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'The column has reached its WIP limit.',
      errors: { columnId: ['This column allows at most 2 task(s).'] },
    });
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('keeps the position on a same-column partial update and replaces assignees', async () => {
    const existing = taskFixture({ assignees: [{ id: 4n, name: 'Ana', lastName: null }] });
    prismaMock.boardColumn.findUnique.mockResolvedValue(globalColumn);
    prismaMock.task.update.mockResolvedValue(taskFixture({ assignees: [] }));

    await taskService.update(existing, { columnId: '10', title: 'Renamed', assigneeIds: [] }, {
      id: 9n,
    });

    const args = prismaMock.task.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 1n });
    expect(args.data).toMatchObject({ title: 'Renamed', assignees: { set: [] } });
    expect(args.data).not.toHaveProperty('position'); // same column -> keep current position
    expect(args.data).not.toHaveProperty('createdById'); // updates never touch the creator
    expect(notifyMock).not.toHaveBeenCalled(); // nobody newly assigned
  });
});

describe('move', () => {
  it('reorders within the same column without a WIP check', async () => {
    const existing = taskFixture();
    prismaMock.boardColumn.findUniqueOrThrow.mockResolvedValue({ ...globalColumn, wipLimit: 1 });
    prismaMock.task.update.mockResolvedValue(existing);

    await taskService.move(existing, '10', 0);

    expect(prismaMock.task.count).not.toHaveBeenCalled();
    // Gap closes in the origin, opens in the destination.
    expect(prismaMock.task.updateMany).toHaveBeenNthCalledWith(1, {
      where: { columnId: 10n, position: { gt: 2 }, id: { not: 1n }, deletedAt: null },
      data: { position: { decrement: 1 } },
    });
    expect(prismaMock.task.updateMany).toHaveBeenNthCalledWith(2, {
      where: { columnId: 10n, position: { gte: 0 }, id: { not: 1n }, deletedAt: null },
      data: { position: { increment: 1 } },
    });
    const update = prismaMock.task.update.mock.calls[0][0];
    expect(update.data).toMatchObject({ columnId: 10n, position: 0, projectId: 5n });
  });

  it('rejects a cross-column move into a full column (WIP limit)', async () => {
    const existing = taskFixture();
    prismaMock.boardColumn.findUniqueOrThrow.mockResolvedValue({
      id: 20n,
      wipLimit: 2,
      board: { id: 1n, projectId: null },
    });
    prismaMock.task.count.mockResolvedValue(2);

    await expect(taskService.move(existing, '20', 0)).rejects.toMatchObject({ status: 422 });
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('moves across columns preserving the project tag on the global board', async () => {
    const existing = taskFixture();
    prismaMock.boardColumn.findUniqueOrThrow.mockResolvedValue({
      id: 20n,
      wipLimit: null,
      board: { id: 1n, projectId: null },
    });
    prismaMock.task.count.mockResolvedValue(0);
    prismaMock.task.update.mockResolvedValue(existing);

    await taskService.move(existing, '20', 1);

    const update = prismaMock.task.update.mock.calls[0][0];
    // Global board (no board project): the task keeps its explicit tag.
    expect(update.data).toMatchObject({ columnId: 20n, position: 1, projectId: 5n });
  });
});

describe('delegate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a task that is not aiDelegable', async () => {
    const task = taskFixture({ aiDelegable: false, column: { isTerminal: false } });
    await expect(taskService.delegate(task)).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a task already in a terminal column', async () => {
    const task = taskFixture({ aiDelegable: true, column: { isTerminal: true } });
    await expect(taskService.delegate(task)).rejects.toMatchObject({ status: 409 });
  });

  it('returns 503 when GITHUB_PAT is not configured', async () => {
    const task = taskFixture({ aiDelegable: true, column: { isTerminal: false } });
    await expect(taskService.delegate(task)).rejects.toMatchObject({ status: 503 });
  });

  it('dispatches the workflow on the repo from aiMetadata.targetRepos, using its default branch', async () => {
    vi.stubEnv('GITHUB_PAT', 'test-pat');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ default_branch: 'develop' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const task = taskFixture({
      aiDelegable: true,
      column: { isTerminal: false },
      aiMetadata: { targetRepos: ['MarkOsBab/tasks-core-api'] },
    });

    const result = await taskService.delegate(task);

    expect(result).toEqual({ repo: 'MarkOsBab/tasks-core-api', ref: 'develop' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/MarkOsBab/tasks-core-api',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-pat' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/MarkOsBab/tasks-core-api/actions/workflows/ai-runner.yml/dispatches',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ ref: 'develop' }) }),
    );
  });

  it('falls back to the default repo when the card has no targetRepos', async () => {
    vi.stubEnv('GITHUB_PAT', 'test-pat');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ default_branch: 'main' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const task = taskFixture({ aiDelegable: true, column: { isTerminal: false }, aiMetadata: null });

    const result = await taskService.delegate(task);

    expect(result).toEqual({ repo: 'micelium-dev/core-tasks-ui', ref: 'main' });
  });

  it('returns 503 when the GitHub API rejects the repo lookup', async () => {
    vi.stubEnv('GITHUB_PAT', 'test-pat');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));
    const task = taskFixture({ aiDelegable: true, column: { isTerminal: false }, aiMetadata: null });

    await expect(taskService.delegate(task)).rejects.toMatchObject({ status: 503 });
  });

  it('returns 503 when the workflow dispatch call fails', async () => {
    vi.stubEnv('GITHUB_PAT', 'test-pat');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ default_branch: 'main' }) })
      .mockResolvedValueOnce({ ok: false, status: 422 });
    vi.stubGlobal('fetch', fetchMock);
    const task = taskFixture({ aiDelegable: true, column: { isTerminal: false }, aiMetadata: null });

    await expect(taskService.delegate(task)).rejects.toMatchObject({ status: 503 });
  });
});
