-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "duration_seconds" INTEGER;

-- Backfill: closed entries get their length stamped; running entries stay NULL.
UPDATE "time_entries"
SET "duration_seconds" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("ended_at" - "started_at"))))::integer
WHERE "ended_at" IS NOT NULL;

-- CreateIndex
CREATE INDEX "time_entries_started_at_idx" ON "time_entries"("started_at");
