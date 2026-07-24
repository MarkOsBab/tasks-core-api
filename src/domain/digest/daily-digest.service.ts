import { prisma } from '@/lib/prisma';
import { optionalEnv } from '@/lib/env';
import { emailEnabled, recipientAllowed, sendMail } from '@/lib/mailer';
import { strId } from '@/resources/serialize';
import { aiActivityService, type AiActivityItem } from '../ai/ai-activity.service';

// Daily cron (see app/api/cron/daily-digest/route.ts + vercel.json): tells the project members
// what the AI agents did in the last 24h and what is waiting for a human. Reuses the same
// viaAgent queries as GET /api/ai/activity (ai-activity.service) so both surfaces agree.

const DAY_MS = 24 * 3600 * 1000;

interface PendingReview {
  id: string;
  title: string;
  prUrl: string;
}

export interface DailyDigestResult {
  sent: boolean;
  recipients: number;
  reason?: string;
}

class DailyDigestService {
  async run(now: Date = new Date()): Promise<DailyDigestResult> {
    const since = new Date(now.getTime() - DAY_MS);

    const [reviewColumnId, activity, newLearnings] = await Promise.all([
      this.reviewColumnId(),
      aiActivityService.build(since, now),
      prisma.projectLearning.findMany({
        where: { deletedAt: null, createdAt: { gte: since, lte: now } },
        orderBy: { createdAt: 'desc' },
        include: { project: true },
      }),
    ]);

    const pendingReview = reviewColumnId ? await this.pendingReview(reviewColumnId) : [];

    const hasActivity =
      pendingReview.length > 0 ||
      activity.counts.trackingSessions > 0 ||
      activity.counts.comments > 0 ||
      activity.counts.cardsCreated > 0 ||
      newLearnings.length > 0;
    if (!hasActivity) return { sent: false, recipients: 0, reason: 'No activity in the last 24h.' };

    if (!emailEnabled()) return { sent: false, recipients: 0, reason: 'Email delivery disabled.' };

    const recipients = await this.recipients();
    if (recipients.length === 0) return { sent: false, recipients: 0, reason: 'No recipients.' };

    const learnings = newLearnings.map((l) => ({
      body: l.body,
      projectName: l.project.name,
    }));
    const { subject, html, text } = renderDigestEmail({ pendingReview, activity, learnings });
    await Promise.all(recipients.map((r) => sendMail({ to: r.email, subject, html, text })));
    return { sent: true, recipients: recipients.length };
  }

  private async reviewColumnId(): Promise<bigint | null> {
    const columns = await prisma.boardColumn.findMany({
      where: { board: { projectId: null } },
      orderBy: { position: 'asc' },
    });
    return [...columns].reverse().find((c) => !c.isTerminal)?.id ?? null;
  }

  private async pendingReview(columnId: bigint): Promise<PendingReview[]> {
    const tasks = await prisma.task.findMany({
      where: { deletedAt: null, columnId, prUrl: { not: null } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, prUrl: true },
    });
    return tasks.map((t) => ({ id: strId(t.id), title: t.title, prUrl: t.prUrl! }));
  }

  /** Distinct, email-eligible members of every non-deleted project. */
  private async recipients(): Promise<{ email: string; name: string }[]> {
    const members = await prisma.user.findMany({
      where: { deletedAt: null, memberProjects: { some: { deletedAt: null } } },
      select: { email: true, name: true },
    });
    const seen = new Set<string>();
    const result: { email: string; name: string }[] = [];
    for (const m of members) {
      if (seen.has(m.email) || !recipientAllowed(m.email)) continue;
      seen.add(m.email);
      result.push({ email: m.email, name: m.name });
    }
    return result;
  }
}

interface DigestData {
  pendingReview: PendingReview[];
  activity: Awaited<ReturnType<typeof aiActivityService.build>>;
  learnings: { body: string; projectName: string }[];
}

function boardUrl(taskId: string): string {
  const webBase = (optionalEnv('APP_WEB_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  return `${webBase}/board?task=${taskId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cardsAndComments(recent: AiActivityItem[]): AiActivityItem[] {
  return recent.filter((item) => item.type === 'card' || item.type === 'comment');
}

function renderDigestEmail({ pendingReview, activity, learnings }: DigestData) {
  const subject = 'Core Tasks — Daily digest';

  const textLines: string[] = ['Core Tasks — Daily digest', ''];
  const htmlSections: string[] = [];

  if (pendingReview.length > 0) {
    textLines.push('PRs waiting for review:');
    pendingReview.forEach((t) => textLines.push(`- ${t.title}: ${t.prUrl} (${boardUrl(t.id)})`));
    textLines.push('');
    htmlSections.push(
      section(
        'PRs waiting for review',
        pendingReview
          .map(
            (t) =>
              `<li style="margin:0 0 8px;"><a href="${escapeHtml(boardUrl(t.id))}" style="color:#6366f1;">${escapeHtml(t.title)}</a> — <a href="${escapeHtml(t.prUrl)}" style="color:#6366f1;">PR</a></li>`,
          )
          .join(''),
      ),
    );
  }

  const highlights = cardsAndComments(activity.recent);
  if (activity.counts.trackingSessions > 0 || activity.counts.cardsCreated > 0 || activity.counts.comments > 0) {
    textLines.push(
      `AI activity (last 24h): ${activity.hours.ai}h tracked, ${activity.counts.cardsCreated} cards created, ${activity.counts.comments} comments.`,
    );
    highlights.forEach((item) =>
      textLines.push(`- [${item.type}] ${item.taskTitle}${item.detail ? `: ${item.detail}` : ''} (${boardUrl(item.taskId ?? '')})`),
    );
    textLines.push('');
    htmlSections.push(
      section(
        'AI activity (last 24h)',
        `<p style="margin:0 0 8px;color:#374151;font-size:14px;">${activity.hours.ai}h tracked · ${activity.counts.cardsCreated} cards created · ${activity.counts.comments} comments</p>` +
          highlights
            .map(
              (item) =>
                `<li style="margin:0 0 8px;">${item.taskId ? `<a href="${escapeHtml(boardUrl(item.taskId))}" style="color:#6366f1;">${escapeHtml(item.taskTitle ?? '')}</a>` : escapeHtml(item.taskTitle ?? '')}${item.detail ? ` — ${escapeHtml(item.detail)}` : ''}</li>`,
            )
            .join(''),
      ),
    );
  }

  if (learnings.length > 0) {
    textLines.push('New learnings:');
    learnings.forEach((l) => textLines.push(`- [${l.projectName}] ${l.body}`));
    textLines.push('');
    htmlSections.push(
      section(
        'New learnings',
        learnings
          .map(
            (l) =>
              `<li style="margin:0 0 8px;"><strong>${escapeHtml(l.projectName)}</strong>: ${escapeHtml(l.body)}</li>`,
          )
          .join(''),
      ),
    );
  }

  const text = textLines.join('\n').trim();
  const html = emailHtml(htmlSections.join(''));
  return { subject, html, text };
}

function section(title: string, itemsHtml: string): string {
  return `<tr>
    <td style="padding:20px 28px 4px;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(title)}</td>
  </tr>
  <tr>
    <td style="padding:0 28px 8px;">
      <ul style="margin:0;padding:0 0 0 18px;color:#374151;font-size:13px;line-height:1.5;">${itemsHtml}</ul>
    </td>
  </tr>`;
}

function emailHtml(sectionsHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#6366f1;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:600;">Core Tasks — Daily digest</td>
            </tr>
            ${sectionsHtml}
            <tr>
              <td style="padding:18px 28px;border-top:1px solid #f0f0f2;color:#9ca3af;font-size:12px;line-height:1.5;">Automated summary of the last 24h of AI agent activity across your projects.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const dailyDigestService = new DailyDigestService();
