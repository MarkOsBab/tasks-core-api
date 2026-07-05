import type { NextRequest } from 'next/server';
import { withRoute } from '@/lib/route';
import { refreshToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public route: accepts an expired token as long as it is inside the refresh window.
export const POST = withRoute(async (req: NextRequest) => {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return Response.json({ message: 'No autenticado.' }, { status: 401 });
  }
  try {
    const { token: fresh, expiresIn } = await refreshToken(token);
    return Response.json({ token: fresh, token_type: 'bearer', expires_in: expiresIn });
  } catch {
    return Response.json({ message: 'No autenticado.' }, { status: 401 });
  }
});
