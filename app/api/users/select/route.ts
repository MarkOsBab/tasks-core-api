import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { prisma } from '@/lib/prisma';
import { userSelectResource } from '@/domain/users/user-select.resource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const q = new URL(req.url).searchParams.get('q');
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const users = await prisma.user.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
    return Response.json(users.map(userSelectResource)); // flat array, no pagination
  }),
);
