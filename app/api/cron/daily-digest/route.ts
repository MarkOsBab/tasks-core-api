import type { NextRequest } from 'next/server';
import { unauthorized } from '@/lib/http-error';
import { withRoute } from '@/lib/route';
import { optionalEnv } from '@/lib/env';
import { dailyDigestService } from '@/domain/digest/daily-digest.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel cron job (see vercel.json): Vercel appends `Authorization: Bearer $CRON_SECRET`
// automatically when that env var is set. No user auth — an unconfigured secret rejects all.
export const GET = withRoute(async (req: NextRequest) => {
  const secret = optionalEnv('CRON_SECRET');
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) throw unauthorized();
  const result = await dailyDigestService.run();
  return Response.json(result);
});
