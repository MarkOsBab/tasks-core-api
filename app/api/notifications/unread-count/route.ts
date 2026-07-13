import { notificationService } from '@/domain/notifications/notification.service';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Badge source: how many unread notifications the authed user has.
export const GET = withRoute(
  withAuth(async (_req, _ctx, user) => {
    const count = await notificationService.unreadCount(user);
    return Response.json({ count });
  }),
);
