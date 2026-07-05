import type { Prisma } from '@prisma/client';

export type ProjectWithClient = Prisma.ProjectGetPayload<{ include: { client: true } }>;
