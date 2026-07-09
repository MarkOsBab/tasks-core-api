import type { Prisma, Project } from '@prisma/client';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';
import type { ProjectWithClient } from './project.types';

function applyProjectFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.clientId !== undefined && filters.clientId !== '') {
    const clientId = toBigIntOrUndefined(filters.clientId);
    if (clientId !== undefined) where.clientId = clientId;
  }
  if (filters.status) where.status = filters.status;
  return where;
}

export class ProjectRepository extends BaseRepository<ProjectWithClient> {
  constructor() {
    super(prisma.project as unknown as ModelDelegate<ProjectWithClient>, {
      searchable: ['name', 'description'],
      sortable: ['id', 'name', 'status', 'startDate', 'endDate', 'createdAt'],
      include: { client: true },
      applyFilters: applyProjectFilters,
    });
  }

  /** Colors already taken (soft-deleted rows included on purpose: their color may come back). */
  async usedColors(): Promise<Array<string | null>> {
    const rows = await prisma.$queryRaw<Array<{ color: string | null }>>`
      SELECT DISTINCT color FROM projects WHERE color IS NOT NULL`;
    return rows.map((row) => row.color);
  }

  /** Non-archived, optional ?clientId scope, ?q on name, ordered by name, top 50. */
  selectOptions(q: string | null, clientId: string | null): Promise<Project[]> {
    const where: Prisma.ProjectWhereInput = { status: { not: 'archived' } };
    if (clientId) {
      const clientBigId = toBigIntOrUndefined(clientId);
      if (clientBigId !== undefined) where.clientId = clientBigId;
    }
    if (q) where.name = { contains: q, mode: 'insensitive' };
    return prisma.project.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }
}

export const projectRepository = new ProjectRepository();
