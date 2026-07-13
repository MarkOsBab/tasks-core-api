import type { Notification } from '@prisma/client';
import { dmyHms, strId } from '@/resources/serialize';

export function notificationResource(n: Notification) {
  return {
    id: strId(n.id),
    type: n.type,
    actorId: n.actorId != null ? strId(n.actorId) : null,
    actorName: n.actorName,
    taskId: n.taskId != null ? strId(n.taskId) : null,
    taskTitle: n.taskTitle,
    link: n.link,
    read: n.readAt != null,
    readAt: dmyHms(n.readAt),
    createdAt: dmyHms(n.createdAt),
  };
}
