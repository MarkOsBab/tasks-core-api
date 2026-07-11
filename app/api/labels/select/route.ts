import type { NextRequest } from 'next/server';
import { withAuth, withRoute } from '@/lib/route';
import { labelSelectResource } from '@/domain/labels/label.resource';
import { labelService } from '@/domain/labels/label.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(
  withAuth(async (req: NextRequest) => {
    const q = new URL(req.url).searchParams.get('q');
    const labels = await labelService.selectOptions(q);
    return Response.json(labels.map(labelSelectResource));
  }),
);
