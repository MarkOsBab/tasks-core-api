import type { NextRequest } from 'next/server';
import { signMcpToken } from '@/lib/auth/jwt';
import { pkceMatches, verifyAuthCode } from '@/domain/oauth/oauth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OAuth token endpoint (public client, so no client secret — PKCE is the proof). Exchanges a
// live authorization code for the same long-lived MCP JWT the REST API verifies. Errors use
// the RFC 6749 {error, error_description} shape (not our 422 contract): OAuth clients parse it.
function oauthError(error: string, description: string, status = 400): Response {
  return Response.json({ error, error_description: description }, { status });
}

export async function POST(req: NextRequest) {
  let params: URLSearchParams;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    params = new URLSearchParams(
      Object.entries(body).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
  } else {
    params = new URLSearchParams(await req.text().catch(() => ''));
  }

  if (params.get('grant_type') !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 'Only authorization_code is supported.');
  }
  const code = params.get('code');
  const codeVerifier = params.get('code_verifier');
  if (!code) return oauthError('invalid_request', 'Missing code.');
  if (!codeVerifier) return oauthError('invalid_request', 'Missing code_verifier (PKCE).');

  let verified;
  try {
    verified = await verifyAuthCode(code);
  } catch {
    return oauthError('invalid_grant', 'Invalid or expired authorization code.');
  }
  const redirectUri = params.get('redirect_uri');
  if (redirectUri !== null && redirectUri !== verified.redirectUri) {
    return oauthError('invalid_grant', 'redirect_uri does not match the authorization request.');
  }
  if (!pkceMatches(codeVerifier, verified.codeChallenge)) {
    return oauthError('invalid_grant', 'PKCE verification failed.');
  }

  const { token, expiresIn } = await signMcpToken(verified.userId);
  return Response.json({
    access_token: token,
    token_type: 'bearer',
    expires_in: expiresIn,
  });
}
