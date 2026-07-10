import type { Prisma } from '@prisma/client';

// trackedSeconds is not a DB column: the service attaches it after a separate aggregate query.
export type ProjectWithClient = Prisma.ProjectGetPayload<{ include: { client: true } }> & {
  trackedSeconds?: number;
};
