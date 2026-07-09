import type { Prisma } from '@prisma/client';

export type TimeEntryWithRelations = Prisma.TimeEntryGetPayload<{
  include: { task: { include: { project: { include: { client: true } } } }; user: true };
}>;
