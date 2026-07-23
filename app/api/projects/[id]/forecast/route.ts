import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { projectService } from '@/domain/projects/project.service';
import { projectForecastService } from '@/domain/projects/project-forecast.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Data-driven delivery forecast (no LLM): remaining estimated hours corrected by the real
// tracked/estimated ratio, projected over the last-14-days velocity.
export const GET = withRoute(
  withAuth(async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const project = await projectService.find(id);
    if (!project) throw notFound();
    return Response.json(await projectForecastService.build(project.id));
  }),
);
