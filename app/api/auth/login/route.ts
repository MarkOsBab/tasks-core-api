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

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(password, user.password) : false;

  if (!user || !valid) {
    return Response.json({ message: 'Credenciales inválidas.' }, { status: 401 });
  }

  const { token, expiresIn } = await signToken(user.id);

  return Response.json({
    token,
    token_type: 'bearer',
    expires_in: expiresIn,
    user: userResource(user),
  });
});
