import type { NextRequest } from 'next/server';
import { projectSelectResource } from '@/domain/projects/project.resource';
import { projectService } from '@/domain/projects/project.service';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const params = new URL(req.url).searchParams;
    const projects = await projectService.selectOptions(params.get('q'), params.get('clientId'));
    return Response.json(projects.map(projectSelectResource)); // flat array, no pagination
  }),
);
