import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { strId } from '@/resources/serialize';
import { HttpError } from '@/lib/http-error';
import type { AuthUser } from '@/lib/auth/context';
import { commentService } from '../comments/comment.service';
import { taskService } from '../tasks/task.service';

// GitHub PR events close the card loop (card -> branch -> PR -> merge): a PR that references a
// task moves its card through the board automatically. The task is detected from the branch name
// (`task-<id>-...`, the pattern the AI runner uses) or, as a fallback, from a `#<id>` mention in
// the PR title/body. Comments are posted viaAgent, so the board shows them as "Tasks IA".

interface PullRequestEvent {
  action?: string;
  pull_request?: {
    html_url?: string;
    title?: string;
    body?: string | null;
    merged?: boolean;
    head?: { ref?: string };
  };
}

export interface WebhookOutcome {
  handled: boolean;
  reason?: string;
  taskId?: string;
  movedTo?: string;
}

const BRANCH_TASK_PATTERN = /^task-(\d+)(?:[-_/]|$)/i;
const MENTION_TASK_PATTERN = /#(\d+)\b/;

class GithubWebhookService {
  /** Constant-time HMAC sha256 check against X-Hub-Signature-256. Unconfigured secret rejects all. */
  verifySignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret || !signature?.startsWith('sha256=')) return false;
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const received = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
  }

  /**
   * pull_request events: opened/reopened/ready_for_review links the PR and parks the card in the
   * review column; closed with merged=true sends it to the terminal column. Everything else is a
   * no-op. Card-level failures (e.g. WIP limit) are reported in the outcome, never as 5xx, so
   * GitHub does not retry-storm the endpoint.
   */
  async handlePullRequest(payload: PullRequestEvent): Promise<WebhookOutcome> {
    const pr = payload.pull_request;
    const url = pr?.html_url;
    if (!pr || !url) return { handled: false, reason: 'Malformed payload.' };

    const action = payload.action ?? '';
    const opened = action === 'opened' || action === 'reopened' || action === 'ready_for_review';
    const merged = action === 'closed' && pr.merged === true;
    if (!opened && !merged) return { handled: false, reason: `Ignored action "${action}".` };

    const task = await this.findReferencedTask(pr);
    if (!task) return { handled: false, reason: 'No task referenced by branch or #id mention.' };

    const actor = await this.resolveActor(task.createdById);
    try {
      if (opened) return await this.onPrOpened(task, url, actor);
      return await this.onPrMerged(task, url, actor);
    } catch (err) {
      // Board-rule rejections (WIP limit and friends) must not bounce the webhook delivery.
      if (err instanceof HttpError) {
        return { handled: false, taskId: strId(task.id), reason: err.message };
      }
      throw err;
    }
  }

  private async onPrOpened(
    task: { id: bigint; columnId: bigint },
    url: string,
    actor: AuthUser | null,
  ): Promise<WebhookOutcome> {
    await prisma.task.update({ where: { id: task.id }, data: { prUrl: url } });

    const columns = await this.globalColumns();
    const review = [...columns].reverse().find((c) => !c.isTerminal);
    const current = columns.find((c) => c.id === task.columnId);
    let movedTo: string | undefined;
    // Never drag a finished card back; a reorder inside the review column is pointless too.
    if (review && current && !current.isTerminal && current.id !== review.id) {
      await this.moveToColumn(task.id, review.id);
      movedTo = review.name;
    }
    await this.comment(task.id, `PR abierto: ${url}`, actor);
    return { handled: true, taskId: strId(task.id), movedTo };
  }

  private async onPrMerged(
    task: { id: bigint; columnId: bigint },
    url: string,
    actor: AuthUser | null,
  ): Promise<WebhookOutcome> {
    const columns = await this.globalColumns();
    const terminal = columns.find((c) => c.isTerminal) ?? columns[columns.length - 1];
    const current = columns.find((c) => c.id === task.columnId);
    let movedTo: string | undefined;
    if (terminal && current && !current.isTerminal) {
      await this.moveToColumn(task.id, terminal.id);
      movedTo = terminal.name;
    }
    await this.comment(task.id, `PR mergeado: ${url}`, actor);
    return { handled: true, taskId: strId(task.id), movedTo };
  }

  /** Branch name wins over title/body mentions; the referenced task must be alive. */
  private async findReferencedTask(pr: NonNullable<PullRequestEvent['pull_request']>) {
    const fromBranch = pr.head?.ref?.match(BRANCH_TASK_PATTERN)?.[1];
    const fromText = `${pr.title ?? ''}\n${pr.body ?? ''}`.match(MENTION_TASK_PATTERN)?.[1];
    for (const candidate of [fromBranch, fromText]) {
      if (!candidate) continue;
      const task = await prisma.task.findFirst({
        where: { id: BigInt(candidate), deletedAt: null },
        select: { id: true, columnId: true, createdById: true },
      });
      if (task) return task;
    }
    return null;
  }

  private globalColumns() {
    return prisma.boardColumn.findMany({
      where: { board: { projectId: null } },
      orderBy: { position: 'asc' },
    });
  }

  private async moveToColumn(taskId: bigint, columnId: bigint): Promise<void> {
    const existing = await taskService.find(strId(taskId));
    if (!existing) return;
    const position = await prisma.task.count({
      where: { columnId, deletedAt: null, id: { not: taskId } },
    });
    await taskService.move(existing, strId(columnId), position);
  }

  /** Comments need an author row: the card's creator, or the first user as a last resort. */
  private async resolveActor(createdById: bigint | null): Promise<AuthUser | null> {
    if (createdById != null) return { id: createdById };
    const fallback = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    return fallback ? { id: fallback.id } : null;
  }

  private async comment(taskId: bigint, body: string, actor: AuthUser | null): Promise<void> {
    if (!actor) return; // no users at all: nothing to attribute the comment to
    await commentService.create({ taskId: strId(taskId), body, viaAgent: true }, actor);
  }
}

export const githubWebhookService = new GithubWebhookService();
