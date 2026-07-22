// Idempotently creates the private `task-attachments` Storage bucket.
// Run once per environment:  node scripts/create-bucket.mjs
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment (.env is loaded below).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Minimal .env loader so this runs standalone without extra deps.
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // no .env file — rely on the real environment
}

const BUCKET = 'task-attachments';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await supabase.storage.getBucket(BUCKET);
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists (public=${existing.public}).`);
  process.exit(0);
}

const { error } = await supabase.storage.createBucket(BUCKET, {
  public: false,
  fileSizeLimit: '25MB',
});
if (error) {
  console.error(`Failed to create bucket "${BUCKET}":`, error.message);
  process.exit(1);
}
console.log(`Created private bucket "${BUCKET}".`);
