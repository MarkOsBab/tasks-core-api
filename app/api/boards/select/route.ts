import type { NextRequest } from 'next/server';
import { boardSelectResource } from '@/domain/boards/board.resource';
import { boardService } from '@/domain/boards/board.service';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const params = new URL(req.url).searchParams;
    const boards = await boardService.selectOptions(params.get('q'));
    return Response.json(boards.map(boardSelectResource)); // flat array, no pagination
  }),
);
