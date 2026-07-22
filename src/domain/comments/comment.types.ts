import type { Prisma } from '@prisma/client';

export type CommentWithRelations = Prisma.CommentGetPayload<{
  include: { task: { include: { assignees: true } }; user: true };
}>;
