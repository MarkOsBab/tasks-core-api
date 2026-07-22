import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskResource, taskSelectResource } from '@/domain/tasks/task.resource';
import type { TaskWithRelations } from '@/domain/tasks/task.types';

const NOW = new Date('2026-07-22T12:00:00Z');

const userA = { id: 4n, name: 'Ana', lastName: 'Pérez', deletedAt: null };
const userB = { id: 5n, name: 'Beto', lastName: null, deletedAt: null };

function fixture(overrides: Record<string, unknown> = {}): TaskWithRelations {
  return {
    id: 1n,
    columnId: 10n,
    title: 'Card',
    description: '<p>desc</p>',
    priority: 'high',
    position: 2,
    dueDate: new Date(Date.UTC(2026, 7, 15)),
    createdAt: new Date(Date.UTC(2026, 6, 1)),
    createdById: 9n,
    createdBy: { id: 9n, name: 'Marcos', lastName: 'García' },
    aiMetadata: null,
    estimatedHours: null,
    column: { id: 10n, name: 'En progreso', boardId: 1n, board: { id: 1n, name: 'Global' } },
    project: {
      id: 5n,
      name: 'Core Tasks',
      color: '#112233',
      deletedAt: null,
      client: { id: 3n, name: 'Micelium', color: '#445566', deletedAt: null },
    },
    projectId: 5n,
    assignees: [userA],
    labels: [{ id: 2n, name: 'DEV', color: '#abcdef', deletedAt: null }],
    timeEntries: [],
    ...overrides,
  } as unknown as TaskWithRelations;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('taskResource', () => {
  it('serializes ids as strings and dates in d/m/Y', () => {
    const res = taskResource(fixture());
    expect(res.id).toBe('1');
    expect(res.columnId).toBe('10');
    expect(res.boardId).toBe('1');
    expect(res.projectId).toBe('5');
    expect(res.clientId).toBe('3');
    expect(res.dueDate).toBe('15/08/2026');
    expect(res.createdAt).toBe('01/07/2026');
    expect(res.createdByName).toBe('Marcos García');
    expect(res.assignees).toEqual([{ id: '4', name: 'Ana Pérez' }]);
    expect(res.labels).toEqual([{ id: '2', name: 'DEV', color: '#abcdef' }]);
  });

  it('guards soft-deleted relations by hand (R4)', () => {
    const res = taskResource(
      fixture({
        project: {
          id: 5n,
          name: 'Trashed',
          color: '#112233',
          deletedAt: new Date(),
          client: { id: 3n, name: 'Micelium', color: '#445566', deletedAt: null },
        },
        assignees: [userA, { ...userB, deletedAt: new Date() }],
        labels: [{ id: 2n, name: 'DEV', color: '#abcdef', deletedAt: new Date() }],
      }),
    );
    expect(res.projectName).toBeNull();
    expect(res.clientId).toBeNull(); // client hangs off the trashed project
    expect(res.assignees).toHaveLength(1);
    expect(res.labels).toEqual([]);
  });

  it('aggregates tracking per user and totals closed entries only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const res = taskResource(
      fixture({
        timeEntries: [
          {
            id: 100n,
            userId: 4n,
            user: userA,
            startedAt: new Date('2026-07-22T10:00:00Z'),
            endedAt: new Date('2026-07-22T10:30:00Z'), // 1800s closed
          },
          {
            id: 101n,
            userId: 4n,
            user: userA,
            startedAt: new Date('2026-07-22T11:00:00Z'),
            endedAt: new Date('2026-07-22T11:10:00Z'), // 600s closed
          },
          {
            id: 102n,
            userId: 5n,
            user: userB,
            startedAt: new Date('2026-07-22T11:50:00Z'),
            endedAt: null, // running for 600s as of NOW
          },
        ],
      }),
    );

    expect(res.trackedSeconds).toBe(2400);
    expect(res.firstTrackedAt).toBe('22/07/2026 10:00:00');
    expect(res.lastTrackedAt).toBe('22/07/2026 11:10:00');
    expect(res.trackedByUser).toEqual([
      { userId: '4', userName: 'Ana Pérez', seconds: 2400, running: false, elapsedSeconds: 0 },
      { userId: '5', userName: 'Beto', seconds: 0, running: true, elapsedSeconds: 600 },
    ]);
    expect(res.runningEntries).toEqual([
      {
        id: '102',
        userId: '5',
        userName: 'Beto',
        startedAt: '22/07/2026 11:50:00',
        elapsedSeconds: 600,
      },
    ]);
  });

  it('exposes estimatedHours as a number and aiMetadata as-is', () => {
    const meta = { acceptanceCriteria: ['done'] };
    const res = taskResource(fixture({ estimatedHours: '2.5', aiMetadata: meta }));
    expect(res.estimatedHours).toBe(2.5);
    expect(res.aiMetadata).toEqual(meta);
    expect(taskResource(fixture()).estimatedHours).toBeNull();
  });
});

describe('taskSelectResource', () => {
  it('returns the { label, value, data } select contract', () => {
    expect(taskSelectResource({ id: 7n, title: 'Card', projectId: 5n } as never)).toEqual({
      label: 'Card',
      value: '7',
      data: { projectId: '5' },
    });
    expect(
      taskSelectResource({ id: 7n, title: 'Card', projectId: null } as never).data.projectId,
    ).toBeNull();
  });
});
