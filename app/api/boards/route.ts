import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { boardResource } from '@/domain/boards/board.resource';
import { storeBoardSchema } from '@/domain/boards/board.schema';
import { boardService } from '@/domain/boards/board.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(boardService, boardResource);
export const POST = createHandler(boardService, boardResource, storeBoardSchema);
