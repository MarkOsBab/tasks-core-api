import { getPublicOrigin } from 'mcp-handler';
import { authorizationServerMetadata } from '@/domain/oauth/oauth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// RFC 8414 metadata. Public and CORS-open: MCP clients (CLI or browser) discover the
// authorize/token/register endpoints from here; origin derives from the request (proxy-aware).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(req: Request) {
  return Response.json(authorizationServerMetadata(getPublicOrigin(req)), { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
