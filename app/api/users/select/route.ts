import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { userSelectResource } from '@/domain/users/user.resource';
import { userService } from '@/domain/users/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const q = new URL(req.url).searchParams.get('q');
    const users = await userService.selectOptions(q);
    return Response.json(users.map(userSelectResource)); // flat array, no pagination
  }),
);
