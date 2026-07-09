-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "color" VARCHAR(7);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "color" VARCHAR(7);

-- Backfill: distinct palette colors per row (same palette as src/lib/colors.ts)
WITH palette AS (
  SELECT ARRAY['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'] AS colors
), numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn FROM "clients"
)
UPDATE "clients" c
SET "color" = (SELECT colors[(n.rn % 12)::int + 1] FROM palette)
FROM numbered n
WHERE n.id = c.id AND c."color" IS NULL;

WITH palette AS (
  SELECT ARRAY['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'] AS colors
), numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn FROM "projects"
)
UPDATE "projects" p
SET "color" = (SELECT colors[(n.rn % 12)::int + 1] FROM palette)
FROM numbered n
WHERE n.id = p.id AND p."color" IS NULL;
