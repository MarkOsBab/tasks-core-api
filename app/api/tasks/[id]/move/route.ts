import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { taskResource } from '@/domain/tasks/task.resource';
import { moveTaskSchema } from '@/domain/tasks/task.schema';
import { taskService } from '@/domain/tasks/task.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute(
  withAuth(async (req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { status, position } = await moveTaskSchema.parseAsync(body);
    const existing = await taskService.find(id);
    if (!existing) throw notFound();
    const moved = await taskService.move(existing, status, position);
    return Response.json(taskResource(moved));
  }),
);
