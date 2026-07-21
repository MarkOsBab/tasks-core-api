import { passwordResetService } from '@/domain/auth/password-reset.service';
import { userService } from '@/domain/users/user.service';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin action from the panel: emails the user a set/reset-password link (invite flavor when
// they never set one). The panel never touches passwords directly.
export const POST = withRoute(
  withAuth(async (_req, ctx) => {
    const { id } = await ctx.params;
    const existing = await userService.find(id);
    if (!existing) throw notFound();
    await passwordResetService.sendPanelReset(existing);
    return new Response(null, { status: 204 });
  }),
);
