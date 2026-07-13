import type { Notification } from '@prisma/client';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate, type OrderBy } from '../base/base.repository';

function applyNotificationFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  // userId is forced by the service (never client-supplied); kept here so paginate() applies it.
  if (filters.userId !== undefined && filters.userId !== '') {
    const userId = toBigIntOrUndefined(filters.userId);
    if (userId !== undefined) where.userId = userId;
  }
  // ?unread=true -> only unread; ?unread=false -> only read.
  if (filters.unread === 'true') where.readAt = null;
  else if (filters.unread === 'false') where.readAt = { not: null };
  if (filters.type) where.type = filters.type;
  return where;
}

export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super(prisma.notification as unknown as ModelDelegate<Notification>, {
      sortable: ['id', 'createdAt'],
      applyFilters: applyNotificationFilters,
    });
  }

  /** Newest first — the inbox reads like a feed. */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

export const notificationRepository = new NotificationRepository();
