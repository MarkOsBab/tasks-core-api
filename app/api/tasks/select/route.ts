import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { taskSelectResource } from '@/domain/tasks/task.resource';
import { taskService } from '@/domain/tasks/task.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const params = new URL(req.url).searchParams;
    const tasks = await taskService.selectOptions(
      params.get('q'),
      params.get('projectId'),
      params.get('boardId'),
    );
    return Response.json(tasks.map(taskSelectResource)); // flat array, no pagination
  }),
);
