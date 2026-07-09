import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { taskService } from '@/domain/tasks/task.service';
import { timeEntryResource } from '@/domain/time-entries/time-entry.resource';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stops the user's running timer on this task; 404 when nothing is running.
export const POST = withRoute(
  withAuth(async (_req: NextRequest, ctx, user) => {
    const { id } = await ctx.params;
    const task = await taskService.find(id);
    if (!task) throw notFound();
    const stopped = await timeEntryService.stop(user.id, task.id);
    if (!stopped) throw notFound();
    return Response.json(timeEntryResource(stopped));
  }),
);
