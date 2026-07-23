import { prisma } from '@/lib/prisma';
import { toBigIntOrUndefined } from '@/lib/ids';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import type { ProjectLearningWithRelations } from './project-learning.types';

function applyProjectLearningFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.projectId !== undefined && filters.projectId !== '') {
    const projectId = toBigIntOrUndefined(filters.projectId);
    if (projectId !== undefined) where.projectId = projectId;
  }
  // ?clientId scopes through the owning project — the learnings panel filters client -> project.
  if (filters.clientId !== undefined && filters.clientId !== '') {
    const clientId = toBigIntOrUndefined(filters.clientId);
    if (clientId !== undefined) where.project = { clientId };
  }
  if (filters.taskId !== undefined && filters.taskId !== '') {
    const taskId = toBigIntOrUndefined(filters.taskId);
    if (taskId !== undefined) where.taskId = taskId;
  }
  if (filters.createdById !== undefined && filters.createdById !== '') {
    const createdById = toBigIntOrUndefined(filters.createdById);
    if (createdById !== undefined) where.createdById = createdById;
  }
  // ?viaAgent=true|false — recorded by an AI agent (MCP add_learning) vs by a human.
  if (filters.viaAgent === 'true') where.viaAgent = true;
  if (filters.viaAgent === 'false') where.viaAgent = false;
  return where;
}

export class ProjectLearningRepository extends BaseRepository<ProjectLearningWithRelations> {
  constructor() {
    super(prisma.projectLearning as unknown as ModelDelegate<ProjectLearningWithRelations>, {
      searchable: ['body'],
      sortable: ['id', 'createdAt'],
      include: { project: { include: { client: true } }, task: true, createdBy: true },
      applyFilters: applyProjectLearningFilters,
    });
  }

  /** Institutional memory reads newest first, same as the MCP feeds it back to agents. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

export const projectLearningRepository = new ProjectLearningRepository();
