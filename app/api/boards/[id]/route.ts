import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { boardResource } from '@/domain/boards/board.resource';
import { updateBoardSchema } from '@/domain/boards/board.schema';
import { boardService } from '@/domain/boards/board.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(boardService, boardResource);
export const PUT = updateHandler(boardService, boardResource, updateBoardSchema);
export const PATCH = updateHandler(boardService, boardResource, updateBoardSchema);
export const DELETE = destroyHandler(boardService);
