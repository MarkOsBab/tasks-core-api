import type { Prisma } from '@prisma/client';

export type AttachmentWithRelations = Prisma.TaskAttachmentGetPayload<{
  include: { uploadedBy: true };
}>;
