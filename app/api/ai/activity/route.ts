import type { NextRequest } from 'next/server';
import { unprocessable } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { dmy } from '@/resources/serialize';
import { aiActivityService } from '@/domain/ai/ai-activity.service';
import { parseDateInput } from '@/domain/tasks/task.schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_WINDOW_DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

function parseBound(value: string | null, label: string): Date | null {
  if (!value) return null;
  const parsed = parseDateInput(value);
  if (parsed === null) throw unprocessable(`Invalid ${label} date. Use d/m/Y or Y-m-d.`);
  return parsed;
}

// AI activity panel data: ?from=&to= (d/m/Y or ISO date; default last 30 days, `to` inclusive).
export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const params = req.nextUrl.searchParams;
    const to = parseBound(params.get('to'), 'to');
    const from = parseBound(params.get('from'), 'from');
    // Date-only bounds: stretch `to` to the end of its day so the range is inclusive.
    const toEnd = new Date((to?.getTime() ?? Date.now()) + (to ? DAY_MS - 1000 : 0));
    const fromStart = from ?? new Date(toEnd.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    if (fromStart > toEnd) throw unprocessable('The from date must be before the to date.');
    const activity = await aiActivityService.build(fromStart, toEnd);
    return Response.json({ from: dmy(fromStart), to: dmy(toEnd), ...activity });
  }),
);
