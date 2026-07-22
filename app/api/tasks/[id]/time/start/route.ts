import type { NextRequest } from 'next/server';
import { forbidden, notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { taskService } from '@/domain/tasks/task.service';
import { timeEntryResource } from '@/domain/time-entries/time-entry.resource';
import { startTimerSchema } from '@/domain/time-entries/time-entry.schema';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Starts the user's timer on this task (auto-stopping whatever else was running).
export const POST = withRoute(
  withAuth(async (req: NextRequest, ctx, user) => {
    const { id } = await ctx.params;
    const { description } = await startTimerSchema.parseAsync(await req.json().catch(() => ({})));
    const task = await taskService.find(id);
    if (!task) throw notFound();
    // Only assignees may track time on a task (the UI also gates this, this is the hard check).
    if (!task.assignees.some((assignee) => assignee.id === user.id)) {
      throw forbidden('Only assignees can track time on this task.');
    }
    const entry = await timeEntryService.start(user.id, task.id, description);
    return Response.json(timeEntryResource(entry), { status: 201 });
  }),
);
