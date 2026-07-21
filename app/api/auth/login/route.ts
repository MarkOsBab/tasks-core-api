import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRoute } from '@/lib/route';
import { signToken } from '@/lib/auth/jwt';
import { verifyPassword } from '@/lib/auth/password';
import { loginSchema } from '@/domain/auth/auth.schema';
import { userResource } from '@/resources/user.resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { email, password } = loginSchema.parse(body);

  // findUnique bypasses the soft-delete extension: a deleted user must not sign in.
  const user = await prisma.user.findUnique({ where: { email } });
  // password null = invited user that never set one: same 401 as bad credentials.
  const valid = user && !user.deletedAt && user.password ? await verifyPassword(password, user.password) : false;

  if (!user || !valid) {
    return Response.json({ message: 'Invalid credentials.' }, { status: 401 });
  }

  const { token, expiresIn } = await signToken(user.id);

  return Response.json({
    token,
    token_type: 'bearer',
    expires_in: expiresIn,
    user: userResource(user),
  });
});
