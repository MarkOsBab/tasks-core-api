import type { Prisma } from '@prisma/client';

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    column: { include: { board: true } };
    project: { include: { client: true } };
    assignee: true;
    createdBy: true;
    timeEntries: { include: { user: true } };
  };
}>;
