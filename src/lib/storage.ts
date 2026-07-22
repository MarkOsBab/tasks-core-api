import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Private bucket that holds every task attachment blob. Kept private: the frontend never touches
// it with a key — uploads go through a short-lived signed upload URL, downloads through a
// short-lived signed download URL, both minted server-side with the service-role key.
export const ATTACHMENTS_BUCKET = 'task-attachments';

const SIGNED_UPLOAD_TTL_NOTE = 'Supabase signed upload URLs are valid for ~2h by default.';
const SIGNED_DOWNLOAD_TTL_SECONDS = 60 * 60; // 1h; the UI re-lists (and re-signs) when the modal reopens

// Lazy service-role client. The service key bypasses RLS, so this MUST stay server-only (never
// shipped to the browser). Mirrors the lazy SES client in mailer.ts.
let client: SupabaseClient | null = null;
function storage(): SupabaseClient['storage'] {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client.storage;
}

export interface SignedUpload {
  path: string;
  token: string;
  url: string; // absolute URL the browser PUTs the blob to
}

/**
 * Mints a signed upload URL for `path` in the attachments bucket. The browser uploads the blob
 * directly to Supabase (no round-trip through the API), so the ~4.5MB Vercel body cap never applies.
 * We build the absolute URL from the token ourselves so we don't depend on the SDK's return shape.
 * {@link SIGNED_UPLOAD_TTL_NOTE}
 */
export async function createSignedUpload(path: string): Promise<SignedUpload> {
  const { data, error } = await storage().from(ATTACHMENTS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error ?? new Error('Failed to create signed upload URL.');
  const base = env('SUPABASE_URL').replace(/\/$/, '');
  const url = `${base}/storage/v1/object/upload/sign/${ATTACHMENTS_BUCKET}/${path}?token=${data.token}`;
  return { path, token: data.token, url };
}

/** Short-lived signed download URL, with a content-disposition filename so the browser saves it right. */
export async function createSignedDownload(path: string, filename: string): Promise<string | null> {
  const { data, error } = await storage()
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_DOWNLOAD_TTL_SECONDS, { download: filename });
  if (error || !data) return null; // a missing/failed blob must not break the whole list
  return data.signedUrl;
}

/** Batch variant so listing N attachments costs one Storage round-trip, not N. Order matches `paths`. */
export async function createSignedDownloads(
  items: { path: string; filename: string }[],
): Promise<(string | null)[]> {
  if (items.length === 0) return [];
  const { data, error } = await storage()
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrls(items.map((i) => i.path), SIGNED_DOWNLOAD_TTL_SECONDS);
  if (error || !data) return items.map(() => null);
  // createSignedUrls has no per-file download option, so re-hint the filename via query param.
  return data.map((entry, i) => {
    if (entry.error || !entry.signedUrl) return null;
    const sep = entry.signedUrl.includes('?') ? '&' : '?';
    return `${entry.signedUrl}${sep}download=${encodeURIComponent(items[i].filename)}`;
  });
}

/** Best-effort blob removal on attachment delete; a storage miss must not fail the soft-delete. */
export async function removeObject(path: string): Promise<void> {
  const { error } = await storage().from(ATTACHMENTS_BUCKET).remove([path]);
  if (error) console.error('[storage] failed to remove object:', path, error);
}
