import type { NextRequest } from 'next/server';
import { showHandler, updateHandler } from '@/domain/base/crud-routes';
import { boardColumnResource } from '@/domain/board-columns/board-column.resource';
import { updateBoardColumnSchema } from '@/domain/board-columns/board-column.schema';
import { boardColumnService } from '@/domain/board-columns/board-column.service';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(boardColumnService, boardColumnResource);
export const PUT = updateHandler(boardColumnService, boardColumnResource, updateBoardColumnSchema);
export const PATCH = updateHandler(boardColumnService, boardColumnResource, updateBoardColumnSchema);

// Custom DELETE: ?moveToColumnId= relocates live tasks before dropping the column (RESTRICT FK).
export const DELETE = withRoute(
  withAuth(async (req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const existing = await boardColumnService.find(id);
    if (!existing) throw notFound();
    const moveToColumnId = new URL(req.url).searchParams.get('moveToColumnId');
    await boardColumnService.destroyWithPolicy(existing, moveToColumnId);
    return new Response(null, { status: 204 });
  }),
);
