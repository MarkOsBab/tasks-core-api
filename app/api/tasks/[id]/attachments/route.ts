import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { toBigIntOrUndefined } from '@/lib/ids';
import { notFound } from '@/lib/http-error';
import { withAuth, withRoute } from '@/lib/route';
import { createSignedDownloads, createSignedUpload } from '@/lib/storage';
import { attachmentResource } from '@/domain/attachments/attachment.resource';
import { signAttachmentSchema, taskExists } from '@/domain/attachments/attachment.schema';
import { attachmentService } from '@/domain/attachments/attachment.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Object key inside the private bucket. The UUID segment keeps names unique (and unguessable);
// the sanitized filename tail keeps the key human-readable in the dashboard.
function storagePath(taskId: bigint, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, '_').slice(0, 100) || 'file';
  return `${taskId}/${randomUUID()}/${safe}`;
}

// GET /tasks/{id}/attachments — confirmed attachments, each with a fresh signed download URL.
export const GET = withRoute(
  withAuth(async (_req: NextRequest, ctx) => {
    const { id } = await ctx.params;
    const taskId = toBigIntOrUndefined(id);
    if (taskId === undefined || !(await taskExists(id))) throw notFound();
    const items = await attachmentService.listForTask(taskId);
    const urls = await createSignedDownloads(
      items.map((a) => ({ path: a.storagePath, filename: a.filename })),
    );
    return Response.json(items.map((a, i) => attachmentResource(a, urls[i])));
  }),
);

// POST /tasks/{id}/attachments — mint a signed upload URL + record the pending metadata row.
export const POST = withRoute(
  withAuth(async (req: NextRequest, ctx, user) => {
    const { id } = await ctx.params;
    const taskId = toBigIntOrUndefined(id);
    if (taskId === undefined || !(await taskExists(id))) throw notFound();
    const body = await req.json().catch(() => ({}));
    const { filename, contentType, size } = await signAttachmentSchema.parseAsync(body);
    const path = storagePath(taskId, filename);
    const upload = await createSignedUpload(path);
    const att = await attachmentService.createPending(
      { taskId, filename, contentType, size, storagePath: path },
      user,
    );
    return Response.json({ attachment: attachmentResource(att, null), upload }, { status: 201 });
  }),
);
