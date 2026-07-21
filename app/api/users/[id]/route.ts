import { showHandler, updateHandler } from '@/domain/base/crud-routes';
import { userResource } from '@/domain/users/user.resource';
import { updateUserSchema } from '@/domain/users/user.schema';
import { userService } from '@/domain/users/user.service';
import { notFound, unprocessable } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(userService, userResource);
export const PUT = updateHandler(userService, userResource, updateUserSchema);
export const PATCH = updateHandler(userService, userResource, updateUserSchema);

// Soft delete (users own tasks/time-entries history, so the row stays). Not the generic
// destroyHandler because deleting the authed user's own account must be rejected.
export const DELETE = withRoute(
  withAuth(async (_req, ctx, user) => {
    const { id } = await ctx.params;
    const existing = await userService.find(id);
    if (!existing) throw notFound();
    if (existing.id === user.id) {
      throw unprocessable('You cannot delete your own user.');
    }
    await userService.delete(existing);
    return new Response(null, { status: 204 });
  }),
);
