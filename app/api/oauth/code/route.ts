import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { signAuthCode, validateAuthorizeParams } from '@/domain/oauth/oauth.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the core-tasks-ui consent screen with the panel's session token when the user
// approves. Mints the authorization code (5-min JWT bound to redirect_uri + PKCE challenge)
// and returns the full redirect URL the UI should navigate to.
export const POST = withRoute(
  withAuth(async (req: NextRequest, _ctx, user) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const params = {
      clientId: typeof body.clientId === 'string' ? body.clientId : '',
      redirectUri: typeof body.redirectUri === 'string' ? body.redirectUri : '',
      state: typeof body.state === 'string' ? body.state : null,
      codeChallenge: typeof body.codeChallenge === 'string' ? body.codeChallenge : '',
      codeChallengeMethod:
        typeof body.codeChallengeMethod === 'string' ? body.codeChallengeMethod : '',
    };
    validateAuthorizeParams(params);

    const code = await signAuthCode(user.id, params);
    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set('code', code);
    if (params.state !== null) redirect.searchParams.set('state', params.state);
    return Response.json({ redirect: redirect.toString() });
  }),
);
