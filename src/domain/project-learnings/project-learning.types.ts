import type { Prisma } from '@prisma/client';

export type ProjectLearningWithRelations = Prisma.ProjectLearningGetPayload<{
  include: { project: { include: { client: true } }; task: true; createdBy: true };
}>;
