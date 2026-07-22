import { getPublicOrigin } from 'mcp-handler';
import { protectedResourceMetadata } from '@/domain/oauth/oauth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// RFC 9728 protected-resource metadata: points MCP clients at our authorization server. The
// optional catch-all also serves the path-suffixed form (/.well-known/oauth-protected-resource
// /api/mcp) some clients request. Public and CORS-open like the AS metadata.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(req: Request) {
  return Response.json(protectedResourceMetadata(getPublicOrigin(req)), { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
