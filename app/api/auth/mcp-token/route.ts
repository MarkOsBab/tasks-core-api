import { withAuth, withRoute } from '@/lib/route';
import { signMcpToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Issues a long-lived bearer token for MCP clients (Claude Code, agents). The caller must
// already be authenticated with a regular session token; actions performed through the MCP
// are attributed to this user.
export const POST = withRoute(
  withAuth(async (_req, _ctx, user) => {
    const { token, expiresIn } = await signMcpToken(user.id);
    return Response.json({ token, token_type: 'bearer', expires_in: expiresIn });
  }),
);
