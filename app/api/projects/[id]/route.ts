import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { projectResource } from '@/domain/projects/project.resource';
import { updateProjectSchema } from '@/domain/projects/project.schema';
import { projectService } from '@/domain/projects/project.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(projectService, projectResource);
export const PUT = updateHandler(projectService, projectResource, updateProjectSchema);
export const PATCH = updateHandler(projectService, projectResource, updateProjectSchema);
export const DELETE = destroyHandler(projectService);
