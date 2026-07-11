import type { AuthUser } from '@/lib/auth/context';
import { BaseService } from '../base/base.service';
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
}

export const commentService = new CommentService(commentRepository);
