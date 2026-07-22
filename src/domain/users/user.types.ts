import type { Prisma } from '@prisma/client';

/** Users always travel with their project memberships (drives the panel + AI assignment). */
export type UserWithProjects = Prisma.UserGetPayload<{
  include: { memberProjects: true };
}>;
