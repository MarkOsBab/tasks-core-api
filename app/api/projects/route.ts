import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { projectResource } from '@/domain/projects/project.resource';
import { storeProjectSchema } from '@/domain/projects/project.schema';
import { projectService } from '@/domain/projects/project.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(projectService, projectResource);
export const POST = createHandler(projectService, projectResource, storeProjectSchema);
