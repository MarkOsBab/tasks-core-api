import { notificationResource } from '@/domain/notifications/notification.resource';
import { notificationService } from '@/domain/notifications/notification.service';
import { paginated, parseListQuery } from '@/lib/pagination';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Inbox of the authed user only — listForUser forces the recipient filter.
export const GET = withRoute(
  withAuth(async (req, _ctx, user) => {
    const { page, size, filters } = parseListQuery(new URL(req.url));
    const { items, total } = await notificationService.listForUser(user, filters, page, size);
    return paginated(items.map(notificationResource), total, page, size);
  }),
);
