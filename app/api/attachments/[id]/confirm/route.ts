import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { createSignedDownload } from '@/lib/storage';
import { attachmentResource } from '@/domain/attachments/attachment.resource';
import { attachmentService } from '@/domain/attachments/attachment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /attachments/{id}/confirm — the browser finished uploading the blob; flip the row to `ready`.
export const POST = withRoute(
  withAuth(async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const existing = await attachmentService.find(id);
    if (!existing) throw notFound();
    const ready = await attachmentService.confirm(existing);
    const url = await createSignedDownload(ready.storagePath, ready.filename);
    return Response.json(attachmentResource(ready, url));
  }),
);
