import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';
import { unprocessable } from '@/lib/http-error';

/**
 * Minimal OAuth 2.0 authorization server for the MCP endpoint (RFC 8414 metadata + RFC 7591
 * dynamic registration + authorization-code grant with mandatory PKCE S256).
 *
 * Design: everything is stateless. Clients are public (token_endpoint_auth_method "none") and
 * never persisted — any client_id is accepted because PKCE, not client identity, binds the code
 * to the token request (with open registration an attacker could register a client anyway).
 * The authorization code is a 5-minute HS256 JWT carrying user + redirect_uri + code_challenge;
 * consent happens in the core-tasks-ui session (the API has no pages), which calls back
 * authenticated to mint the code. Access tokens are the same long-lived MCP JWTs the REST
 * API verifies (see signMcpToken).
 */

const CODE_TTL_SECONDS = 300;
const CODE_AUDIENCE = 'core-tasks-oauth-code';

const secretKey = () => new TextEncoder().encode(env('JWT_SECRET'));

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
}

/** Shared by the authorize redirect and the code endpoint: reject before involving the user. */
export function validateAuthorizeParams(params: AuthorizeParams): void {
  if (!params.clientId) throw unprocessable('Missing client_id.');
  if (!params.redirectUri || !/^https?:\/\//.test(params.redirectUri)) {
    throw unprocessable('redirect_uri must be an absolute http(s) URL.');
  }
  if (!params.codeChallenge) throw unprocessable('code_challenge is required (PKCE).');
  if (params.codeChallengeMethod !== 'S256') {
    throw unprocessable('Only the S256 code_challenge_method is supported.');
  }
}

export async function signAuthCode(userId: bigint, params: AuthorizeParams): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_challenge: params.codeChallenge,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(userId))
    .setAudience(CODE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + CODE_TTL_SECONDS)
    .sign(secretKey());
}

export interface VerifiedCode {
  userId: string;
  redirectUri: string;
  clientId: string;
  codeChallenge: string;
}

export async function verifyAuthCode(code: string): Promise<VerifiedCode> {
  const { payload } = await jwtVerify(code, secretKey(), {
    algorithms: ['HS256'],
    audience: CODE_AUDIENCE,
  });
  if (
    !payload.sub ||
    typeof payload.redirect_uri !== 'string' ||
    typeof payload.client_id !== 'string' ||
    typeof payload.code_challenge !== 'string'
  ) {
    throw new Error('Malformed authorization code');
  }
  return {
    userId: String(payload.sub),
    redirectUri: payload.redirect_uri,
    clientId: payload.client_id,
    codeChallenge: payload.code_challenge,
  };
}

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge bound into the code. */
export function pkceMatches(codeVerifier: string, codeChallenge: string): boolean {
  const digest = createHash('sha256').update(codeVerifier).digest('base64url');
  return digest === codeChallenge;
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
  };
}
