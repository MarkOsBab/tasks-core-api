import type { AuthUser } from '@/lib/auth/context';
import { nextUniqueColor } from '@/lib/colors';
import { BaseService } from '../base/base.service';
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

  async list(filters: Record<string, string>, page: number, size: number) {
    const result = await super.list(filters, page, size);
    await this.attachTrackedSeconds(result.items);
    return result;
  }

  async find(id: string): Promise<ProjectWithClient | null> {
    const project = await super.find(id);
    if (project) await this.attachTrackedSeconds([project]);
    return project;
  }

  async update(
    existing: ProjectWithClient,
    data: Record<string, unknown>,
    user?: AuthUser,
  ): Promise<ProjectWithClient> {
    const updated = await super.update(existing, data, user);
    await this.attachTrackedSeconds([updated]);
    return updated;
  }

  private async attachTrackedSeconds(items: ProjectWithClient[]): Promise<void> {
    if (items.length === 0) return;
    const map = await this.projects.trackedSecondsByProjectIds(items.map((item) => item.id));
    for (const item of items) {
      item.trackedSeconds = map.get(item.id.toString()) ?? 0;
    }
  }

  /** Single-board model: projects no longer get a board of their own (all tasks live on the
   * global board, tagged with a projectId). */
  async create(data: Record<string, unknown>): Promise<ProjectWithClient> {
    const project = await super.create(data);
    project.trackedSeconds = 0;
    return project;
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
