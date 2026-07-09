import type { Prisma } from '@prisma/client';
import { nextUniqueColor } from '@/lib/colors';
import { prisma } from '@/lib/prisma';
import { BaseService } from '../base/base.service';
import { defaultBoardData } from '../boards/board.service';
import { ProjectRepository, projectRepository } from './project.repository';
import type { ProjectWithClient } from './project.types';

const DMY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepts d/m/Y or ISO YYYY-MM-DD; UTC midnight so @db.Date values never shift a day. */
function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const trimmed = value.trim();
  const dmyMatch = DMY_PATTERN.exec(trimmed);
  if (dmyMatch) {
    return new Date(Date.UTC(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1])));
  }
  const isoMatch = ISO_PATTERN.exec(trimmed);
  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

class ProjectService extends BaseService<ProjectWithClient> {
  constructor(private readonly projects: ProjectRepository) {
    super(projects);
  }

  selectOptions(q: string | null, clientId: string | null) {
    return this.projects.selectOptions(q, clientId);
  }

  /** A new project gets its own board (with the default columns) in the same transaction. */
  async create(data: Record<string, unknown>): Promise<ProjectWithClient> {
    const prepared = await this.prepare(data, null);
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: prepared as Prisma.ProjectUncheckedCreateInput,
        include: { client: true },
      });
      await tx.board.create({ data: defaultBoardData(project.id) });
      return project;
    });
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: ProjectWithClient | null,
  ): Promise<Record<string, unknown>> {
    const prepared = { ...data };
    if (typeof prepared.clientId === 'string') prepared.clientId = BigInt(prepared.clientId);
    if ('startDate' in prepared) prepared.startDate = parseDateInput(prepared.startDate);
    if ('endDate' in prepared) prepared.endDate = parseDateInput(prepared.endDate);
    if (prepared.color === '') prepared.color = null;
    // Every project gets a unique visual color unless one is explicitly chosen.
    if (!existing && prepared.color == null) {
      prepared.color = nextUniqueColor(await this.projects.usedColors());
    }
    return prepared;
  }
}

export const projectService = new ProjectService(projectRepository);
