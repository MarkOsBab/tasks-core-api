import type { NextRequest } from 'next/server';
import { boardColumnResource } from '@/domain/board-columns/board-column.resource';
import { moveColumnSchema } from '@/domain/board-columns/board-column.schema';
import { boardColumnService } from '@/domain/board-columns/board-column.service';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute(
  withAuth(async (req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { position } = await moveColumnSchema.parseAsync(body);
    const existing = await boardColumnService.find(id);
    if (!existing) throw notFound();
    const moved = await boardColumnService.move(existing, position);
    return Response.json(boardColumnResource(moved));
  }),
);
