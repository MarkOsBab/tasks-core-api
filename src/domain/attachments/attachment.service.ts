import type { AuthUser } from '@/lib/auth/context';
import { removeObject } from '@/lib/storage';
import { BaseService } from '../base/base.service';
import { AttachmentRepository, attachmentRepository } from './attachment.repository';
import type { AttachmentWithRelations } from './attachment.types';

export interface PendingAttachmentInput {
  taskId: bigint;
  filename: string;
  contentType: string;
  size: number;
  storagePath: string;
}

class AttachmentService extends BaseService<AttachmentWithRelations> {
  constructor(attachments: AttachmentRepository) {
    super(attachments);
  }

  listForTask(taskId: bigint): Promise<AttachmentWithRelations[]> {
    return (this.repository as AttachmentRepository).forTask(taskId);
  }

  /** Records the metadata row in `pending` state; the blob is not up yet (client uploads next). */
  createPending(input: PendingAttachmentInput, user?: AuthUser): Promise<AttachmentWithRelations> {
    return this.repository.create({
      taskId: input.taskId,
      filename: input.filename,
      contentType: input.contentType,
      size: input.size,
      storagePath: input.storagePath,
      uploadedById: user?.id ?? null,
      status: 'pending',
    });
  }

  /** Flips a pending row to `ready` once the browser confirms the blob finished uploading. */
  confirm(existing: AttachmentWithRelations): Promise<AttachmentWithRelations> {
    return this.repository.update(existing.id, { status: 'ready' });
  }

  /** Soft-deletes the row and best-effort removes the blob so orphans do not accrue in the bucket. */
  async delete(existing: AttachmentWithRelations): Promise<boolean> {
    const ok = await super.delete(existing);
    await removeObject(existing.storagePath);
    return ok;
  }
}

export const attachmentService = new AttachmentService(attachmentRepository);
