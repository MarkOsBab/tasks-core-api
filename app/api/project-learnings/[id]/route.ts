import { destroyHandler, showHandler } from '@/domain/base/crud-routes';
import { projectLearningResource } from '@/domain/project-learnings/project-learning.resource';
import { projectLearningService } from '@/domain/project-learnings/project-learning.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(projectLearningService, projectLearningResource);
// Retiring a stale learning stops get_task/find_project from feeding it back to agents.
export const DELETE = destroyHandler(projectLearningService);
