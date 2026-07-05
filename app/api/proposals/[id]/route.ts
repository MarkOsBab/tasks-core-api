import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { proposalResource } from '@/domain/proposals/proposal.resource';
import { updateProposalSchema } from '@/domain/proposals/proposal.schema';
import { proposalService } from '@/domain/proposals/proposal.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(proposalService, proposalResource);
export const PUT = updateHandler(proposalService, proposalResource, updateProposalSchema);
export const PATCH = updateHandler(proposalService, proposalResource, updateProposalSchema);
export const DELETE = destroyHandler(proposalService);
