import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signToken } from '@/lib/auth/jwt';
import {
  authorizationServerMetadata,
  pkceMatches,
  protectedResourceMetadata,
  signAuthCode,
  validateAuthorizeParams,
  verifyAuthCode,
  type AuthorizeParams,
} from '@/domain/oauth/oauth.service';

const params: AuthorizeParams = {
  clientId: 'client-abc',
  redirectUri: 'http://localhost:33418/callback',
  state: 'xyz',
  codeChallenge: 'challenge',
  codeChallengeMethod: 'S256',
};

afterEach(() => {
  vi.useRealTimers();
});

describe('validateAuthorizeParams', () => {
  it('accepts valid PKCE S256 params', () => {
    expect(() => validateAuthorizeParams(params)).not.toThrow();
  });

  it('rejects a missing client_id', () => {
    expect(() => validateAuthorizeParams({ ...params, clientId: '' })).toThrow('Missing client_id.');
  });

  it('rejects a non-absolute redirect_uri', () => {
    expect(() => validateAuthorizeParams({ ...params, redirectUri: 'urn:ietf:wg:oauth' })).toThrow(
      'redirect_uri must be an absolute http(s) URL.',
    );
  });

  it('rejects a missing code_challenge — PKCE is mandatory', () => {
    expect(() => validateAuthorizeParams({ ...params, codeChallenge: '' })).toThrow(
      'code_challenge is required (PKCE).',
    );
  });

  it('rejects any method but S256, as a 422', () => {
    let thrown: unknown;
    try {
      validateAuthorizeParams({ ...params, codeChallengeMethod: 'plain' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({
      status: 422,
      message: 'Only the S256 code_challenge_method is supported.',
    });
  });
});

describe('signAuthCode / verifyAuthCode', () => {
  it('round-trips user, redirect_uri, client and challenge', async () => {
    const code = await signAuthCode(9n, params);
    await expect(verifyAuthCode(code)).resolves.toEqual({
      userId: '9',
      redirectUri: params.redirectUri,
      clientId: params.clientId,
      codeChallenge: params.codeChallenge,
    });
  });

  it('expires after 5 minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const code = await signAuthCode(9n, params);
    vi.setSystemTime(new Date('2026-01-01T00:05:01Z'));
    await expect(verifyAuthCode(code)).rejects.toThrow();
  });

  it('rejects a regular access token (audience mismatch)', async () => {
    const { token } = await signToken(9n);
    await expect(verifyAuthCode(token)).rejects.toThrow();
  });

  it('rejects garbage', async () => {
    await expect(verifyAuthCode('garbage')).rejects.toThrow();
  });
});

describe('pkceMatches', () => {
  it('matches base64url(sha256(verifier)) against the challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches('another-verifier', challenge)).toBe(false);
  });
});

describe('discovery metadata', () => {
  it('derives every endpoint from the origin', () => {
    const meta = authorizationServerMetadata('https://api.example.com');
    expect(meta).toMatchObject({
      issuer: 'https://api.example.com',
      authorization_endpoint: 'https://api.example.com/api/oauth/authorize',
      token_endpoint: 'https://api.example.com/api/oauth/token',
      registration_endpoint: 'https://api.example.com/api/oauth/register',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  it('points the protected resource at the MCP endpoint', () => {
    expect(protectedResourceMetadata('https://api.example.com')).toEqual({
      resource: 'https://api.example.com/api/mcp',
      authorization_servers: ['https://api.example.com'],
      bearer_methods_supported: ['header'],
    });
  });
});
