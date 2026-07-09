import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { timeEntryResource } from '@/domain/time-entries/time-entry.resource';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The authenticated user's running timer (or null) — lets the UI restore the ticking state on load.
export const GET = withRoute(
  withAuth(async (_req: NextRequest, _ctx, user) => {
    const running = await timeEntryService.findRunning(user.id);
    return Response.json(running ? timeEntryResource(running) : null);
  }),
);
