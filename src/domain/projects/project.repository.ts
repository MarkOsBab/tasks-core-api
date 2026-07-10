import { Prisma, type Project } from '@prisma/client';
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

  /** Closed-entry seconds per project, summed via its tasks (TimeEntry has no direct projectId). */
  async trackedSecondsByProjectIds(ids: bigint[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.$queryRaw<Array<{ project_id: bigint; tracked_seconds: bigint }>>(
      Prisma.sql`
        SELECT t.project_id, COALESCE(SUM(te.duration_seconds), 0) AS tracked_seconds
        FROM time_entries te
        JOIN tasks t ON t.id = te.task_id
        WHERE te.deleted_at IS NULL AND t.deleted_at IS NULL AND t.project_id IN (${Prisma.join(ids)})
        GROUP BY t.project_id
      `,
    );
    return new Map(rows.map((row) => [row.project_id.toString(), Number(row.tracked_seconds)]));
  }
}

export const projectRepository = new ProjectRepository();
