import { z } from 'zod';
import { toBigIntOrUndefined } from '@/lib/ids';
import { prisma } from '@/lib/prisma';
import { lmsg, reqString } from '@/lib/validation';

/** 25MB — matches the bucket's fileSizeLimit; rejected up front so we never mint a doomed upload URL. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Goes through the extended client, so soft-deleted tasks are NOT valid targets.
export async function taskExists(id: string): Promise<boolean> {
  const bigId = toBigIntOrUndefined(id);
  if (bigId === undefined) return false;
  const task = await prisma.task.findFirst({ where: { id: bigId }, select: { id: true } });
  return task !== null;
}

export const signAttachmentSchema = z.object({
  filename: reqString('filename', 255),
  contentType: reqString('contentType', 255),
  size: z
    .number({ required_error: lmsg.required('size'), invalid_type_error: lmsg.number('size') })
    .int(lmsg.integer('size'))
    .min(1, lmsg.min('size', 1))
    .max(MAX_ATTACHMENT_BYTES, lmsg.max('size', MAX_ATTACHMENT_BYTES)),
});
