import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emailEnabled, sendMail } from '@/lib/mailer';
import { verifyPassword } from '@/lib/auth/password';
import { hashResetToken } from '@/lib/auth/reset-token';
import { passwordResetService } from '@/domain/auth/password-reset.service';
import type { PrismaMock } from '../../helpers/prisma-mock';

vi.mock('@/lib/prisma', async () => {
  const { createPrismaMock } = await import('../../helpers/prisma-mock');
  return { prisma: createPrismaMock(), rawExists: vi.fn().mockResolvedValue(false) };
});

vi.mock('@/lib/mailer', () => ({
  emailEnabled: vi.fn(() => false),
  recipientAllowed: vi.fn(() => true),
  sendMail: vi.fn(),
}));

const prismaMock = prisma as unknown as PrismaMock;
const emailEnabledMock = emailEnabled as unknown as Mock;
const sendMailMock = sendMail as unknown as Mock;

const user = {
  id: 9n,
  name: 'Marcos',
  lastName: 'García',
  email: 'marcos@example.com',
  password: '$2b$10$hash',
  deletedAt: null,
} as unknown as User;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestReset', () => {
  it('no-ops silently on unknown emails (no user enumeration)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(passwordResetService.requestReset('ghost@example.com')).resolves.toBeUndefined();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('no-ops on soft-deleted users (findUnique bypasses the extension)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, deletedAt: new Date() });
    await passwordResetService.requestReset(user.email);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('issues a single-use token and logs the link when email is disabled', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    await passwordResetService.requestReset(user.email);

    // A new request voids anything issued before, atomically with the new token.
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
    const createArgs = prismaMock.passwordResetToken.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe(user.id);
    expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const ttlMinutes = (createArgs.data.expiresAt.getTime() - Date.now()) / 60_000;
    expect(ttlMinutes).toBeGreaterThan(58); // PASSWORD_RESET_TTL default: 60 min
    expect(ttlMinutes).toBeLessThan(62);

    expect(sendMailMock).not.toHaveBeenCalled();
    const logged = (console.log as unknown as Mock).mock.calls.flat().join(' ');
    expect(logged).toContain('/reset-password?token=');
    // The persisted hash must match the raw token in the logged link.
    const raw = /token=([0-9a-f]{64})/.exec(logged)?.[1];
    expect(raw).toBeDefined();
    expect(hashResetToken(raw as string)).toBe(createArgs.data.tokenHash);
  });

  it('sends the reset email when delivery is enabled', async () => {
    emailEnabledMock.mockReturnValue(true);
    prismaMock.user.findUnique.mockResolvedValue(user);
    await passwordResetService.requestReset(user.email);
    expect(sendMailMock).toHaveBeenCalledOnce();
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toBe('Reset your Core Tasks password');
    expect(mail.text).toContain('/reset-password?token=');
  });

  it('still resolves 200-style when delivery blows up (best-effort)', async () => {
    emailEnabledMock.mockReturnValue(true);
    sendMailMock.mockRejectedValue(new Error('SES down'));
    prismaMock.user.findUnique.mockResolvedValue(user);
    await expect(passwordResetService.requestReset(user.email)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('sendPanelReset', () => {
  it('sends an invite when the user never set a password', async () => {
    emailEnabledMock.mockReturnValue(true);
    await passwordResetService.sendPanelReset({ ...user, password: null } as unknown as User);
    expect(sendMailMock.mock.calls[0][0].subject).toBe(
      'Welcome to Core Tasks — set your password',
    );
  });

  it('sends a plain reset when the user has a password', async () => {
    emailEnabledMock.mockReturnValue(true);
    await passwordResetService.sendPanelReset(user);
    expect(sendMailMock.mock.calls[0][0].subject).toBe('Reset your Core Tasks password');
  });

  it('throws on delivery failure — the admin must know the email did not go out', async () => {
    emailEnabledMock.mockReturnValue(true);
    sendMailMock.mockRejectedValue(new Error('SES down'));
    await expect(passwordResetService.sendPanelReset(user)).rejects.toThrow('SES down');
  });
});

describe('reset', () => {
  const record = {
    id: 1n,
    userId: 9n,
    tokenHash: hashResetToken('raw-token'),
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  it('422s on an unknown token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(passwordResetService.reset('raw-token', 'newpass123')).rejects.toMatchObject({
      status: 422,
      message: 'The reset link is invalid or has expired.',
    });
  });

  it('422s on a used token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({ ...record, usedAt: new Date() });
    await expect(passwordResetService.reset('raw-token', 'newpass123')).rejects.toMatchObject({
      status: 422,
    });
  });

  it('422s on an expired token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...record,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(passwordResetService.reset('raw-token', 'newpass123')).rejects.toMatchObject({
      status: 422,
    });
  });

  it('sets the hashed password and burns the token atomically', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(record);
    await passwordResetService.reset('raw-token', 'newpass123');

    expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashResetToken('raw-token') },
    });
    const userUpdate = prismaMock.user.update.mock.calls[0][0];
    expect(userUpdate.where).toEqual({ id: record.userId });
    await expect(verifyPassword('newpass123', userUpdate.data.password)).resolves.toBe(true);
    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: record.id },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
