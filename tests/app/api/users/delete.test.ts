import { beforeAll, describe, expect, it, vi } from 'vitest';
import { signToken } from '@/lib/auth/jwt';
import { userService } from '@/domain/users/user.service';
import { DELETE } from '../../../../app/api/users/[id]/route';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

vi.mock('@/domain/users/user.service', () => ({
  userService: { find: vi.fn(), delete: vi.fn() },
}));

const findMock = userService.find as unknown as ReturnType<typeof vi.fn>;
const deleteMock = userService.delete as unknown as ReturnType<typeof vi.fn>;

let authHeader: string;

beforeAll(async () => {
  const { token } = await signToken(9n); // authed caller: user 9
  authHeader = `Bearer ${token}`;
});

function deleteRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/users/5', { method: 'DELETE', headers });
}

describe('DELETE /api/users/{id}', () => {
  it('401s without a token', async () => {
    const res = await DELETE(deleteRequest() as never, { params: Promise.resolve({ id: '5' }) });
    expect(res.status).toBe(401);
  });

  it('404s on an unknown user', async () => {
    findMock.mockResolvedValue(null);
    const res = await DELETE(deleteRequest({ Authorization: authHeader }) as never, {
      params: Promise.resolve({ id: '5' }),
    });
    expect(res.status).toBe(404);
  });

  it('422s when trying to delete the authenticated user itself', async () => {
    findMock.mockResolvedValue({ id: 9n });
    const res = await DELETE(deleteRequest({ Authorization: authHeader }) as never, {
      params: Promise.resolve({ id: '9' }),
    });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ message: 'You cannot delete your own user.' });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('soft-deletes any other user and answers 204', async () => {
    findMock.mockResolvedValue({ id: 5n });
    deleteMock.mockResolvedValue(true);
    const res = await DELETE(deleteRequest({ Authorization: authHeader }) as never, {
      params: Promise.resolve({ id: '5' }),
    });
    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith({ id: 5n });
  });
});
