-- Add an optional external link (URL) to proposals (proposal doc, deck, etc.).
-- Nullable additive column: metadata-only change, no table rewrite, no backfill.
ALTER TABLE "proposals" ADD COLUMN "link" TEXT;
