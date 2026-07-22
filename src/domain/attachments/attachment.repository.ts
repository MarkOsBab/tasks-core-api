import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';
import type { AttachmentWithRelations } from './attachment.types';

function applyAttachmentFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.taskId !== undefined && filters.taskId !== '') {
    const taskId = toBigIntOrUndefined(filters.taskId);
    if (taskId !== undefined) where.taskId = taskId;
  }
  return where;
}

export class AttachmentRepository extends BaseRepository<AttachmentWithRelations> {
  constructor() {
    super(prisma.taskAttachment as unknown as ModelDelegate<AttachmentWithRelations>, {
      sortable: ['id', 'createdAt'],
      include: { uploadedBy: true },
      applyFilters: applyAttachmentFilters,
    });
  }

  /** Newest attachment first. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  /** Every confirmed (`ready`) attachment on a task; pending uploads never surface. */
  forTask(taskId: bigint): Promise<AttachmentWithRelations[]> {
    return this.delegate.findMany({
      where: { taskId, status: 'ready' },
      include: this.config.include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

export const attachmentRepository = new AttachmentRepository();
