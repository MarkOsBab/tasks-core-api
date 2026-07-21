import type { NextRequest } from 'next/server';
import { withRoute } from '@/lib/route';
import { forgotPasswordSchema } from '@/domain/auth/auth.schema';
import { passwordResetService } from '@/domain/auth/password-reset.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public. Always 200 with the same body — the response never reveals whether the email exists.
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { email } = forgotPasswordSchema.parse(body);

  await passwordResetService.requestReset(email);

  return Response.json({ message: 'If the email exists, a reset link has been sent.' });
});
