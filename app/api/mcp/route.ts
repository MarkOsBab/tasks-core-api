import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyToken } from '@/lib/auth/jwt';
import { registerMcpTools } from '@/domain/mcp/mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Streamable-HTTP MCP endpoint at /api/mcp (stateless: no Redis, SSE disabled). Tools are
// registered per-request; the heavy lifting lives in src/domain/mcp/.
const handler = createMcpHandler(
  (server) => registerMcpTools(server),
  { serverInfo: { name: 'core-tasks', version: '1.0.0' } },
  { basePath: '/api', disableSse: true, maxDuration: 120 },
);

// Same stateless HS256 JWTs as the REST API (issue one with POST /api/auth/mcp-token). The
// user id rides in authInfo.extra so tools can attribute comments/moves to a real user.
const authed = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    try {
      const { sub } = await verifyToken(bearerToken);
      return { token: bearerToken, clientId: 'core-tasks-mcp', scopes: [], extra: { userId: sub } };
    } catch {
      return undefined;
    }
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
