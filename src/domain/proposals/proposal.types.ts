import type { Prisma } from '@prisma/client';

export type ProposalWithProject = Prisma.ProposalGetPayload<{ include: { project: true } }>;
