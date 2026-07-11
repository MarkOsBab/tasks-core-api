import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { commentResource } from '@/domain/comments/comment.resource';
import { storeCommentSchema } from '@/domain/comments/comment.schema';
import { commentService } from '@/domain/comments/comment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(commentService, commentResource);
export const POST = createHandler(commentService, commentResource, storeCommentSchema);
