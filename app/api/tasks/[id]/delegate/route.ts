import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { taskService } from '@/domain/tasks/task.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Delegates the card to the AI runner on-demand (workflow_dispatch), instead of waiting for the
// nightly cron. The runner itself picks which delegable card to work on.
export const POST = withRoute(
  withAuth(async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const task = await taskService.find(id);
    if (!task) throw notFound();
    const result = await taskService.delegate(task);
    return Response.json({ dispatched: true, ...result }, { status: 202 });
  }),
);
