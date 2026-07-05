import { dmy, dmyHms, strId } from '@/resources/serialize';
import type { ProposalWithProject } from './proposal.types';

export function proposalResource(proposal: ProposalWithProject) {
  return {
    id: strId(proposal.id),
    projectId: strId(proposal.projectId),
    // The soft-delete extension does not filter nested includes: guard trashed relation by hand.
    projectName: proposal.project && !proposal.project.deletedAt ? proposal.project.name : null,
    title: proposal.title,
    description: proposal.description,
    amount: proposal.amount === null ? null : Number(proposal.amount),
    currency: proposal.currency,
    status: proposal.status,
    sentAt: dmyHms(proposal.sentAt),
    validUntil: dmy(proposal.validUntil),
    createdAt: dmyHms(proposal.createdAt),
  };
}
