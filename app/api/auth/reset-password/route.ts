import type { NextRequest } from 'next/server';
import { withRoute } from '@/lib/route';
import { resetPasswordSchema } from '@/domain/auth/auth.schema';
import { passwordResetService } from '@/domain/auth/password-reset.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: the bearer here is the emailed single-use token, not a JWT.
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { token, password } = resetPasswordSchema.parse(body);

  await passwordResetService.reset(token, password);

  return Response.json({ message: 'Password has been reset.' });
});
