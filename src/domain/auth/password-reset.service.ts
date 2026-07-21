import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emailEnabled, recipientAllowed, sendMail } from '@/lib/mailer';
import { intEnv, optionalEnv } from '@/lib/env';
import { hashPassword } from '@/lib/auth/password';
import { generateResetToken, hashResetToken } from '@/lib/auth/reset-token';
import { unprocessable } from '@/lib/http-error';

// 'reset' = forgot-password (short-lived); 'invite' = brand-new user setting the first password
// (longer window). Both redeem through the same /reset-password endpoint.
type PasswordEmailKind = 'reset' | 'invite';

const RESET_TTL_MINUTES = () => intEnv('PASSWORD_RESET_TTL', 60);
const INVITE_TTL_MINUTES = () => intEnv('PASSWORD_INVITE_TTL', 10080); // 7 days

class PasswordResetService {
  /** Forgot-password entrypoint. Silently no-ops on unknown emails (no user enumeration). */
  async requestReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return; // findUnique bypasses the soft-delete extension
    try {
      await this.issueAndSend(user, 'reset');
    } catch (err) {
      // Delivery is best-effort: the endpoint always answers 200 so the response never
      // reveals whether the address exists or whether SES is having a bad day.
      console.error('[auth] reset email delivery failed:', err);
    }
  }

  /** Invite email for a just-created user (no password yet). Never throws — creation must not fail on SES. */
  async sendInvite(user: User): Promise<void> {
    try {
      await this.issueAndSend(user, 'invite');
    } catch (err) {
      console.error('[auth] invite email delivery failed:', err);
    }
  }

  /**
   * Panel-triggered reset (users/{id}/reset-password): re-invites if the user never set a
   * password, plain reset otherwise. Unlike the public flows this one THROWS on delivery
   * failure — the admin clicked a button and deserves to know the email did not go out.
   */
  async sendPanelReset(user: User): Promise<void> {
    await this.issueAndSend(user, user.password ? 'reset' : 'invite');
  }

  /** Redeems a token: sets the new password and burns the token. 422 on invalid/expired/used. */
  async reset(rawToken: string, password: string): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(rawToken) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw unprocessable('The reset link is invalid or has expired.', {
        token: ['The reset link is invalid or has expired.'],
      });
    }
    const hashed = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  }

  private async issueAndSend(user: User, kind: PasswordEmailKind): Promise<void> {
    const raw = generateResetToken();
    const ttlMinutes = kind === 'invite' ? INVITE_TTL_MINUTES() : RESET_TTL_MINUTES();
    await prisma.$transaction([
      // One live token per user: a new request voids anything issued before.
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(raw),
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      }),
    ]);

    const webBase = (optionalEnv('APP_WEB_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
    const url = `${webBase}/reset-password?token=${raw}`;

    if (!emailEnabled() || !recipientAllowed(user.email)) {
      // Dev / SES-sandbox fallback: surface the link server-side so the flow stays testable.
      console.log(`[auth] email skipped (disabled or recipient blocked) — ${kind} link for ${user.email}: ${url}`);
      return;
    }
    const { subject, html, text } = renderPasswordEmail(kind, user.name, url, ttlMinutes);
    await sendMail({ to: user.email, subject, html, text });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ttlLabel(ttlMinutes: number): string {
  if (ttlMinutes % 1440 === 0) {
    const days = ttlMinutes / 1440;
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (ttlMinutes % 60 === 0) {
    const hours = ttlMinutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${ttlMinutes} minutes`;
}

/** Subject + HTML/text bodies. Emails are English (server-side), same as notifications. */
function renderPasswordEmail(kind: PasswordEmailKind, recipientName: string, url: string, ttlMinutes: number) {
  const expiry = ttlLabel(ttlMinutes);
  const subject = kind === 'invite' ? 'Welcome to Core Tasks — set your password' : 'Reset your Core Tasks password';
  const headline =
    kind === 'invite'
      ? 'Your Core Tasks account has been created. Set a password to start signing in'
      : 'We received a request to reset your Core Tasks password';
  const cta = kind === 'invite' ? 'Set password' : 'Reset password';
  const footer =
    kind === 'invite'
      ? `This link expires in ${expiry}. If you were not expecting this invitation, you can ignore this email.`
      : `This link expires in ${expiry}. If you did not request a password reset, you can safely ignore this email.`;
  const text = `Hi ${recipientName},\n\n${headline}.\n\n${cta}: ${url}\n\n${footer}\n\n— Core Tasks`;
  return { subject, html: emailHtml(recipientName, headline, url, cta, footer), text };
}

function emailHtml(recipientName: string, headline: string, url: string, cta: string, footer: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#6366f1;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:600;">Core Tasks</td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 12px;color:#111827;font-size:15px;">Hi ${escapeHtml(recipientName)},</p>
                <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">${escapeHtml(headline)}.</p>
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">${escapeHtml(cta)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #f0f0f2;color:#9ca3af;font-size:12px;line-height:1.5;">${escapeHtml(footer)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const passwordResetService = new PasswordResetService();
