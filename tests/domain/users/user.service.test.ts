import { describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { passwordResetService } from '@/domain/auth/password-reset.service';
import { userService } from '@/domain/users/user.service';
import type { UserWithProjects } from '@/domain/users/user.types';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

vi.mock('@/domain/auth/password-reset.service', () => ({
  passwordResetService: { sendInvite: vi.fn() },
}));

const prismaMock = prisma as unknown as PrismaMock;
const sendInviteMock = passwordResetService.sendInvite as unknown as ReturnType<typeof vi.fn>;

const existing = {
  id: 5n,
  email: 'ana@example.com',
  memberProjects: [],
} as unknown as UserWithProjects;

describe('create', () => {
  it('creates without a password and sends the invite email', async () => {
    const created = { id: 6n, email: 'new@example.com' };
    prismaMock.user.create.mockResolvedValue(created);

    await userService.create({ name: 'New', email: 'new@example.com', projectIds: ['8'] });

    const args = prismaMock.user.create.mock.calls[0][0];
    expect(args.data).not.toHaveProperty('password');
    expect(args.data.memberProjects).toEqual({ connect: [{ id: 8n }] });
    expect(sendInviteMock).toHaveBeenCalledWith(created);
  });
});

describe('update', () => {
  it('keeps the current password when the field is empty or missing', async () => {
    prismaMock.user.update.mockResolvedValue(existing);
    await userService.update(existing, { name: 'Ana', password: '' });
    expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('password');
  });

  it('hashes a provided password and full-replaces project membership', async () => {
    prismaMock.user.update.mockResolvedValue(existing);
    await userService.update(existing, { password: 'newpass123', projectIds: ['1', '2'] });
    const data = prismaMock.user.update.mock.calls[0][0].data;
    await expect(verifyPassword('newpass123', data.password)).resolves.toBe(true);
    expect(data.memberProjects).toEqual({ set: [{ id: 1n }, { id: 2n }] });
  });
});

describe('delete', () => {
  it('soft-deletes with an email tombstone and burns live reset tokens', async () => {
    await expect(userService.delete(existing)).resolves.toBe(true);
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 5n },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 5n },
      data: {
        deletedAt: expect.any(Date),
        email: 'deleted.5.ana@example.com', // frees the unique address for a re-create
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
