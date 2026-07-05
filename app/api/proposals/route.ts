import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { proposalResource } from '@/domain/proposals/proposal.resource';
import { storeProposalSchema } from '@/domain/proposals/proposal.schema';
import { proposalService } from '@/domain/proposals/proposal.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(proposalService, proposalResource);
export const POST = createHandler(proposalService, proposalResource, storeProposalSchema);
