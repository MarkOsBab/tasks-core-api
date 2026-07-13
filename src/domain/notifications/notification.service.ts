import type { Notification } from '@prisma/client';
import type { AuthUser } from '@/lib/auth/context';
import { optionalEnv } from '@/lib/env';
import { emailEnabled, recipientAllowed, sendMail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { NotificationRepository, notificationRepository } from './notification.repository';

export type NotificationType = 'task_assigned' | 'comment_added';

export interface NotifyInput {
  userId: bigint; // recipient
  type: NotificationType;
  actorId?: bigint | null;
  actorName?: string | null;
  taskId?: bigint | null;
  taskTitle?: string | null;
  link?: string | null;
}

/** Deep link the UI opens from a notification: the project view when tagged, else the global board. */
export function buildTaskLink(task: { id: bigint; projectId: bigint | null }): string {
  return task.projectId != null
    ? `/projects/${task.projectId}?task=${task.id}`
    : `/board?task=${task.id}`;
}

class NotificationService extends BaseService<Notification> {
  constructor(notifications: NotificationRepository) {
    super(notifications);
  }

  /** Inbox scoped to the authed user — the recipient filter is forced, never client-supplied. */
  listForUser(user: AuthUser, filters: Record<string, string>, page: number, size: number) {
    return this.list({ ...filters, userId: String(user.id) }, page, size);
  }

  unreadCount(user: AuthUser): Promise<number> {
    return prisma.notification.count({ where: { userId: user.id, readAt: null } });
  }

  /** Marks one notification read, only if it belongs to the caller. Returns it, or null (=> 404). */
  async markRead(user: AuthUser, id: string): Promise<Notification | null> {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      return null;
    }
    const existing = await prisma.notification.findFirst({ where: { id: bigId, userId: user.id } });
    if (!existing) return null;
    if (existing.readAt) return existing;
    return prisma.notification.update({ where: { id: bigId }, data: { readAt: new Date() } });
  }

  /** Marks every unread notification of the caller as read. Returns how many were updated. */
  async markAllRead(user: AuthUser): Promise<number> {
    const { count } = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }

  /**
   * Creates the in-app notification and fires the email best-effort. Never notifies the actor about
   * their own action. A failed email is swallowed (the in-app record stands, emailedAt stays null).
   */
  async notify(input: NotifyInput): Promise<Notification | null> {
    if (input.actorId != null && input.actorId === input.userId) return null;
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        taskId: input.taskId ?? null,
        taskTitle: input.taskTitle ?? null,
        link: input.link ?? null,
      },
    });
    await this.maybeEmail(created);
    return created;
  }

  private async maybeEmail(notification: Notification): Promise<void> {
    if (!emailEnabled()) return;
    try {
      const recipient = await prisma.user.findUnique({
        where: { id: notification.userId },
        select: { email: true, name: true },
      });
      if (!recipient?.email || !recipientAllowed(recipient.email)) return;
      const { subject, html, text } = renderEmail(notification, recipient.name);
      await sendMail({ to: recipient.email, subject, html, text });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailedAt: new Date() },
      });
    } catch (err) {
      console.error('[notifications] email delivery failed:', err);
    }
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

/** Builds the subject + HTML/text bodies from the notification. Emails are English (server-side). */
function renderEmail(n: Notification, recipientName: string) {
  const webBase = (optionalEnv('APP_WEB_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  const url = n.link ? `${webBase}${n.link}` : webBase;
  const actor = n.actorName ?? 'Someone';
  const task = n.taskTitle ?? 'a task';
  const headline =
    n.type === 'task_assigned'
      ? `${actor} assigned you the task “${task}”`
      : `${actor} commented on “${task}”`;
  const subject =
    n.type === 'task_assigned' ? `New task assigned: ${task}` : `New comment on: ${task}`;
  const text = `Hi ${recipientName},\n\n${headline}.\n\nOpen it: ${url}\n\n— Core Tasks`;
  return { subject, html: emailHtml(recipientName, headline, url), text };
}

function emailHtml(recipientName: string, headline: string, url: string): string {
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
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">Open task</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #f0f0f2;color:#9ca3af;font-size:12px;line-height:1.5;">You are receiving this because you are involved in this task in Core Tasks.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const notificationService = new NotificationService(notificationRepository);
