import type { AuthUser } from '@/lib/auth/context';
import { BaseService } from '../base/base.service';
import { buildTaskLink, notificationService } from '../notifications/notification.service';
import { CommentRepository, commentRepository } from './comment.repository';
import type { CommentWithRelations } from './comment.types';

class CommentService extends BaseService<CommentWithRelations> {
  constructor(comments: CommentRepository) {
    super(comments);
  }

  protected prepare(
    data: Record<string, unknown>,
    existing: CommentWithRelations | null,
    user?: AuthUser,
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = { ...data };

    // Author is stamped once from the authed caller; updates never touch it.
    if (!existing) prepared.userId = user?.id ?? null;

    if (typeof prepared.taskId === 'string') {
      prepared.taskId = BigInt(prepared.taskId); // existence already validated by the schema
    }

    return prepared;
  }

  async create(data: Record<string, unknown>, user?: AuthUser): Promise<CommentWithRelations> {
    const created = await super.create(data, user);
    await this.notifyParticipants(created, user);
    return created;
  }

  /** Notifies the task's assignee and creator (except the commenter) about a new comment. */
  private async notifyParticipants(comment: CommentWithRelations, actor?: AuthUser): Promise<void> {
    const task = comment.task;
    if (!task) return;
    const actorId = actor?.id ?? comment.userId;
    const actorName = `${comment.user.name} ${comment.user.lastName ?? ''}`.trim();
    const recipients = new Set<bigint>();
    if (task.assigneeId != null) recipients.add(task.assigneeId);
    if (task.createdById != null) recipients.add(task.createdById);
    recipients.delete(actorId); // never notify the commenter
    for (const userId of recipients) {
      try {
        await notificationService.notify({
          userId,
          type: 'comment_added',
          actorId,
          actorName,
          taskId: task.id,
          taskTitle: task.title,
          link: buildTaskLink(task),
        });
      } catch (err) {
        console.error('[comments] comment notification failed:', err);
      }
    }
  }
}

export const commentService = new CommentService(commentRepository);
