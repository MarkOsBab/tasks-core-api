import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { attachmentService } from '@/domain/attachments/attachment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /attachments/{id} — soft-delete the row and remove the blob from the bucket.
export const DELETE = withRoute(
  withAuth(async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const existing = await attachmentService.find(id);
    if (!existing) throw notFound();
    await attachmentService.delete(existing);
    return new Response(null, { status: 204 });
  }),
);
