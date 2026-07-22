import { beforeAll, describe, expect, it, vi } from 'vitest';
import { signToken } from '@/lib/auth/jwt';
import { taskService } from '@/domain/tasks/task.service';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';
import { POST } from '../../../../app/api/tasks/[id]/time/start/route';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

vi.mock('@/domain/tasks/task.service', () => ({
  taskService: { find: vi.fn() },
}));

vi.mock('@/domain/time-entries/time-entry.service', () => ({
  timeEntryService: { start: vi.fn() },
}));

vi.mock('@/domain/time-entries/time-entry.resource', () => ({
  timeEntryResource: vi.fn(() => ({ id: '51' })),
}));

const findMock = taskService.find as unknown as ReturnType<typeof vi.fn>;
const startMock = timeEntryService.start as unknown as ReturnType<typeof vi.fn>;

let authHeader: string;

beforeAll(async () => {
  const { token } = await signToken(9n);
  authHeader = `Bearer ${token}`;
});

function startRequest(headers: Record<string, string> = {}, body: unknown = {}): Request {
  return new Request('http://localhost/api/tasks/7/time/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: '7' }) };

describe('POST /api/tasks/{id}/time/start', () => {
  it('401s without a token', async () => {
    const res = await POST(startRequest() as never, ctx);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: 'Unauthenticated.' });
  });

  it('404s on an unknown task', async () => {
    findMock.mockResolvedValue(null);
    const res = await POST(startRequest({ Authorization: authHeader }) as never, ctx);
    expect(res.status).toBe(404);
  });

  it('403s when the caller is not an assignee (hard permission check)', async () => {
    findMock.mockResolvedValue({ id: 7n, assignees: [{ id: 5n }] });
    const res = await POST(startRequest({ Authorization: authHeader }) as never, ctx);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      message: 'Only assignees can track time on this task.',
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  it('starts the timer for an assignee', async () => {
    findMock.mockResolvedValue({ id: 7n, assignees: [{ id: 5n }, { id: 9n }] });
    startMock.mockResolvedValue({ id: 51n });
    const res = await POST(
      startRequest({ Authorization: authHeader }, { description: 'focus' }) as never,
      ctx,
    );
    expect(res.status).toBe(201);
    expect(startMock).toHaveBeenCalledWith(9n, 7n, 'focus');
  });
});
