import { prisma } from '@/lib/prisma';
import { unauthorized } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { userResource } from '@/resources/user.resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The only authenticated route that needs the full user row: load it here (the auth layer only
// resolves the id from the JWT and never hits the DB).
export const GET = withRoute(
  withAuth(async (_req, _ctx, user) => {
    const full = await prisma.user.findUnique({ where: { id: user.id } });
    // findUnique bypasses the soft-delete extension: a deleted user's live JWT stops here.
    if (!full || full.deletedAt) throw unauthorized();
    return Response.json(userResource(full));
  }),
);
