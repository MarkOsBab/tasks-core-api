import { BaseService } from '../base/base.service';
import { ProposalRepository, proposalRepository } from './proposal.repository';
import { parseDateInput } from './proposal.schema';
import type { ProposalWithProject } from './proposal.types';

class ProposalService extends BaseService<ProposalWithProject> {
  constructor(proposals: ProposalRepository) {
    super(proposals);
  }

  protected prepare(
    data: Record<string, unknown>,
    existing: ProposalWithProject | null,
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = { ...data };

    if (typeof prepared.projectId === 'string') {
      prepared.projectId = BigInt(prepared.projectId); // existence already validated by the schema
    }

    if (prepared.currency == null) {
      delete prepared.currency; // column is non-nullable: keep DB default / current value
    } else {
      prepared.currency = String(prepared.currency).toUpperCase();
    }

    if (typeof prepared.validUntil === 'string') {
      prepared.validUntil = parseDateInput(prepared.validUntil);
    }

    // Stamp sentAt the first time the proposal transitions to sent.
    if (prepared.status === 'sent' && !existing?.sentAt) {
      prepared.sentAt = new Date();
    }

    return prepared;
  }
}

export const proposalService = new ProposalService(proposalRepository);
