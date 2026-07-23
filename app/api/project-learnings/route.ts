import { listHandler } from '@/domain/base/crud-routes';
import { projectLearningResource } from '@/domain/project-learnings/project-learning.resource';
import { projectLearningService } from '@/domain/project-learnings/project-learning.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Read-only listing: learnings are written by the MCP (add_learning), not by the panel.
export const GET = listHandler(projectLearningService, projectLearningResource);
