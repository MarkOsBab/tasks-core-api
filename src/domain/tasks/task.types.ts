import type { Prisma } from '@prisma/client';

/** Resolved view of one aiMetadata.dependsOnTaskIds entry: enough to flag blocked cards. */
export interface TaskDependency {
  id: bigint;
  title: string;
  done: boolean; // the dependency sits in a terminal column
}

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    column: { include: { board: true } };
    project: { include: { client: true } };
    assignees: true;
    createdBy: true;
    timeEntries: { include: { user: true } };
    labels: true;
  };
}> & {
  /** Attached in batch by TaskService.list (list endpoint only); absent elsewhere. */
  dependsOn?: TaskDependency[];
};
