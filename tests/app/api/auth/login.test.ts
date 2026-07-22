import { beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { verifyToken } from '@/lib/auth/jwt';
import { POST } from '../../../../app/api/auth/login/route';
import type { PrismaMock } from '../../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

const prismaMock = prisma as unknown as PrismaMock;

function loginRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({}) };

let user: Record<string, unknown>;

beforeAll(async () => {
  user = {
    id: 9n,
    name: 'Marcos',
    lastName: 'García',
    email: 'marcos@example.com',
    image: null,
    role: 'Fullstack Developer',
    password: await hashPassword('secret123'),
    deletedAt: null,
  };
});

describe('POST /api/auth/login', () => {
  it('422s on an invalid body (never 500)', async () => {
    const res = await POST(loginRequest({}) as never, ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors.email).toContain('The email field is required.');
  });

  it('401s on an unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(
      loginRequest({ email: 'ghost@example.com', password: 'x' }) as never,
      ctx,
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: 'Invalid credentials.' });
  });

  it('401s on a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await POST(
      loginRequest({ email: user.email, password: 'wrong-pass' }) as never,
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('401s for a soft-deleted user even with the right password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, deletedAt: new Date() });
    const res = await POST(
      loginRequest({ email: user.email, password: 'secret123' }) as never,
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('401s for an invited user that never set a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, password: null });
    const res = await POST(
      loginRequest({ email: user.email, password: 'secret123' }) as never,
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it('returns a verifiable bearer token and the user resource on success', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    const res = await POST(
      loginRequest({ email: user.email, password: 'secret123' }) as never,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token_type).toBe('bearer');
    expect(body.expires_in).toBe(3600);
    await expect(verifyToken(body.token)).resolves.toEqual({ sub: '9' });
    expect(body.user).toEqual({
      id: '9',
      name: 'Marcos',
      lastName: 'García',
      email: 'marcos@example.com',
      image: null,
      role: 'Fullstack Developer',
    });
  });
});
