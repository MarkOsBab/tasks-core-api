import type { NextRequest } from 'next/server';
import { unauthorized } from '@/lib/http-error';
import { withRoute } from '@/lib/route';
import { githubWebhookService } from '@/domain/webhooks/github-webhook.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GitHub webhook receiver (no user auth: authenticity comes from the HMAC signature over the
// raw body, so the body must be read as text BEFORE any JSON parsing).
export const POST = withRoute(async (req: NextRequest) => {
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!githubWebhookService.verifySignature(raw, signature)) throw unauthorized();

  const event = req.headers.get('x-github-event');
  if (event === 'ping') return Response.json({ ok: true });
  if (event !== 'pull_request') {
    return Response.json({ handled: false, reason: `Ignored event "${event ?? 'unknown'}".` });
  }

  const payload = JSON.parse(raw) as Parameters<typeof githubWebhookService.handlePullRequest>[0];
  return Response.json(await githubWebhookService.handlePullRequest(payload));
});
