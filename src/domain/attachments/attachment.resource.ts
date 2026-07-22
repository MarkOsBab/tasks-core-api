import { dmyHms, strId } from '@/resources/serialize';
import type { AttachmentWithRelations } from './attachment.types';

/**
 * `url` is a short-lived signed download URL minted by the caller (batched on list, single on
 * confirm) — null when the blob is not yet uploaded or signing failed.
 */
export function attachmentResource(att: AttachmentWithRelations, url: string | null) {
  return {
    id: strId(att.id),
    taskId: strId(att.taskId),
    filename: att.filename,
    contentType: att.contentType,
    size: att.size,
    url,
    uploadedById: att.uploadedById != null ? strId(att.uploadedById) : null,
    uploadedByName: att.uploadedBy
      ? `${att.uploadedBy.name} ${att.uploadedBy.lastName ?? ''}`.trim()
      : null,
    createdAt: dmyHms(att.createdAt),
  };
}
