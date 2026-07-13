import { notFound } from '@/lib/http-error';
import { notificationResource } from '@/domain/notifications/notification.resource';
import { notificationService } from '@/domain/notifications/notification.service';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Marks one notification read (ownership-checked in the service; a foreign/missing id => 404).
export const POST = withRoute(
  withAuth(async (_req, ctx, user) => {
    const { id } = await ctx.params;
    const updated = await notificationService.markRead(user, id);
    if (!updated) throw notFound();
    return Response.json(notificationResource(updated));
  }),
);
