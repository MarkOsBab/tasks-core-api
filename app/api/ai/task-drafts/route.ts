import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { generateDraftsSchema } from '@/domain/ai/ai-draft.schema';
import { aiDraftService } from '@/domain/ai/ai-draft.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// LLM generation runs well past Vercel's default function timeout; give it real headroom.
export const maxDuration = 300;

export const POST = withRoute(
  withAuth(async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
    const { input, projectId } = await generateDraftsSchema.parseAsync(body);
    const drafts = await aiDraftService.generate(input, projectId ?? null);
    return Response.json({ drafts });
  }),
);
