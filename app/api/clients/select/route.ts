import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { clientSelectResource } from '@/domain/clients/client.resource';
import { clientService } from '@/domain/clients/client.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const q = new URL(req.url).searchParams.get('q');
    const clients = await clientService.selectOptions(q);
    return Response.json(clients.map(clientSelectResource)); // flat array, no pagination
  }),
);
