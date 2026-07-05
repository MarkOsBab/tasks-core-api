import type { Prisma } from '@prisma/client';

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: { project: true; assignee: true };
}>;
