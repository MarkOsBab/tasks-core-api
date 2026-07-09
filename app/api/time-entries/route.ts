import type { NextRequest } from 'next/server';
import { listHandler } from '@/domain/base/crud-routes';
import { withAuth, withRoute } from '@/lib/route';
import { timeEntryResource } from '@/domain/time-entries/time-entry.resource';
import { storeTimeEntrySchema } from '@/domain/time-entries/time-entry.schema';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(timeEntryService, timeEntryResource);

// Custom create: the entry is always owned by the authenticated user (userId never comes from the body).
export const POST = withRoute(
  withAuth(async (req: NextRequest, _ctx, user) => {
    const data = await storeTimeEntrySchema.parseAsync(await req.json().catch(() => ({})));
    const created = await timeEntryService.createForUser(user.id, data);
    return Response.json(timeEntryResource(created), { status: 201 });
  }),
);
