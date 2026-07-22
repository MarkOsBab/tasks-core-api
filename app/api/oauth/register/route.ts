import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { withRoute } from '@/lib/route';
import { unprocessable } from '@/lib/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// RFC 7591 dynamic client registration, stateless: nothing is persisted — every client is a
// public client and PKCE (not client identity) secures the code exchange, so we just echo the
// registration back with a fresh client_id. Public route (clients register before having auth).
export const POST = withRoute(async (req: NextRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === 'string')
    : [];
  if (redirectUris.length === 0) {
    throw unprocessable('redirect_uris is required.');
  }
  return Response.json(
    {
      client_id: randomUUID(),
      client_name: typeof body.client_name === 'string' ? body.client_name : 'MCP client',
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    },
    { status: 201 },
  );
});
