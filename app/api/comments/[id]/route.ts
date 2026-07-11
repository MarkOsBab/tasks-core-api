import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { commentResource } from '@/domain/comments/comment.resource';
import { updateCommentSchema } from '@/domain/comments/comment.schema';
import { commentService } from '@/domain/comments/comment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(commentService, commentResource);
export const PUT = updateHandler(commentService, commentResource, updateCommentSchema);
export const PATCH = updateHandler(commentService, commentResource, updateCommentSchema);
export const DELETE = destroyHandler(commentService);
