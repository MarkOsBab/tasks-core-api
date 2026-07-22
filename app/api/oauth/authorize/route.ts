import type { NextRequest } from 'next/server';
import { withRoute } from '@/lib/route';
import { optionalEnv } from '@/lib/env';
import { unprocessable } from '@/lib/http-error';
import { validateAuthorizeParams } from '@/domain/oauth/oauth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// OAuth authorization endpoint. The API has no pages, so after validating the request it hands
// off to the core-tasks-ui consent screen (which reuses the panel's login session and calls
// POST /api/oauth/code authenticated to mint the actual code). Public route by nature.
export const GET = withRoute(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  if (q.get('response_type') !== 'code') {
    throw unprocessable('Only response_type=code is supported.');
  }
  validateAuthorizeParams({
    clientId: q.get('client_id') ?? '',
    redirectUri: q.get('redirect_uri') ?? '',
    state: q.get('state'),
    codeChallenge: q.get('code_challenge') ?? '',
    codeChallengeMethod: q.get('code_challenge_method') ?? '',
  });

  const webBase = (optionalEnv('APP_WEB_URL') ?? 'http://localhost:4200').replace(/\/$/, '');
  const consent = new URL(`${webBase}/oauth/authorize`);
  for (const key of ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method']) {
    const value = q.get(key);
    if (value !== null) consent.searchParams.set(key, value);
  }
  return Response.redirect(consent.toString(), 302);
});
