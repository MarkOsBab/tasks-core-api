import type { Prisma } from '@prisma/client';

export type BoardWithRelations = Prisma.BoardGetPayload<{
  include: { project: true; columns: true };
}>;
