import { withAuth, withRoute } from '@/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stateless JWT: nothing to invalidate server-side.
export const POST = withRoute(withAuth(async () => Response.json({ message: 'Sesión cerrada.' })));
