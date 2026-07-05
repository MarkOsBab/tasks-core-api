import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';
import type { ProposalWithProject } from './proposal.types';

function applyProposalFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.projectId !== undefined && filters.projectId !== '') {
    const projectId = toBigIntOrUndefined(filters.projectId);
    if (projectId !== undefined) where.projectId = projectId;
  }
  if (filters.status) where.status = filters.status;
  return where;
}

export class ProposalRepository extends BaseRepository<ProposalWithProject> {
  constructor() {
    super(prisma.proposal as unknown as ModelDelegate<ProposalWithProject>, {
      searchable: ['title'],
      sortable: ['id', 'title', 'amount', 'status', 'sentAt', 'createdAt'],
      include: { project: true },
      applyFilters: applyProposalFilters,
    });
  }
}

export const proposalRepository = new ProposalRepository();
