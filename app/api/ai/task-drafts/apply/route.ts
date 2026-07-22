import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { taskResource } from '@/domain/tasks/task.resource';
import { applyDraftsSchema } from '@/domain/ai/ai-draft.schema';
import { aiDraftService } from '@/domain/ai/ai-draft.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute(
  withAuth(async (req: NextRequest, _ctx, user) => {
    const body = await req.json().catch(() => ({}));
    const { drafts } = await applyDraftsSchema.parseAsync(body);
    const created = await aiDraftService.apply(drafts, user);
    return Response.json({ data: created.map(taskResource) });
  }),
);
