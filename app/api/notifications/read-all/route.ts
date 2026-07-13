import { notificationService } from '@/domain/notifications/notification.service';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Marks every unread notification of the authed user as read.
export const POST = withRoute(
  withAuth(async (_req, _ctx, user) => {
    const updated = await notificationService.markAllRead(user);
    return Response.json({ updated });
  }),
);
