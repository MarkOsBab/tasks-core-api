import { dmyHms, strId } from '@/resources/serialize';
import { AGENT_COMMENT_AUTHOR } from './comment.constants';
import type { CommentWithRelations } from './comment.types';

export function commentResource(comment: CommentWithRelations) {
  return {
    id: strId(comment.id),
    taskId: strId(comment.taskId),
    // The soft-delete extension does not filter nested includes: guard the trashed relation by hand.
    taskTitle: comment.task && !comment.task.deletedAt ? comment.task.title : null,
    userId: strId(comment.userId),
    userName: comment.viaAgent
      ? AGENT_COMMENT_AUTHOR
      : `${comment.user.name} ${comment.user.lastName ?? ''}`.trim(),
    viaAgent: comment.viaAgent,
    body: comment.body,
    createdAt: dmyHms(comment.createdAt),
  };
}
