import type { Prisma } from '@prisma/client';

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: { column: { include: { board: true } }; project: true; assignee: true };
}>;
