import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { boardColumnResource } from '@/domain/board-columns/board-column.resource';
import { storeBoardColumnSchema } from '@/domain/board-columns/board-column.schema';
import { boardColumnService } from '@/domain/board-columns/board-column.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(boardColumnService, boardColumnResource);
export const POST = createHandler(boardColumnService, boardColumnResource, storeBoardColumnSchema);
