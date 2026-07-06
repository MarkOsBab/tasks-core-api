-- Boards + BoardColumns feature.
--
-- Replaces the fixed Task.status enum with a per-board column model:
--   * one Board per existing project + one global Board (project_id NULL)
--   * 4 default columns seeded on every board (matching the old TaskStatus values)
--   * tasks.status -> tasks.column_id (FK), tasks.project_id becomes optional
--
-- The DDL matches `prisma migrate diff`; the data backfill (steps 2-4) is hand-written
-- because Prisma cannot add a required FK column to a populated table on its own.
-- The whole file runs in one transaction (Postgres DDL is transactional) so a failure
-- rolls back cleanly.

-- 1. New tables + indexes + FKs (must exist before we can seed / reference them)
CREATE TABLE "boards" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "board_columns" (
    "id" BIGSERIAL NOT NULL,
    "board_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "wip_limit" INTEGER,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "boards_project_id_key" ON "boards"("project_id");
CREATE INDEX "board_columns_board_id_position_idx" ON "board_columns"("board_id", "position");

ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_fkey"
    FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. One board per EXISTING project (raw SQL sees soft-deleted projects too: their tasks
--    still need a column) + the single global board.
INSERT INTO "boards" ("project_id", "name", "created_at")
    SELECT "id", 'Tablero', CURRENT_TIMESTAMP FROM "projects";
INSERT INTO "boards" ("project_id", "name", "created_at")
    VALUES (NULL, 'Tablero global', CURRENT_TIMESTAMP);

-- 3. Seed the 4 default columns on every board (colors match the old UI COLUMN_COLORS).
INSERT INTO "board_columns" ("board_id", "name", "position", "color", "is_terminal", "created_at")
    SELECT b."id", v."name", v."position", v."color", v."is_terminal", CURRENT_TIMESTAMP
    FROM "boards" b
    CROSS JOIN (VALUES
        ('Pendiente',   0, '#94a3b8', false),
        ('En progreso', 1, '#f59e0b', false),
        ('En revisión',  2, '#8b5cf6', false),
        ('Terminada',   3, '#22c55e', true)
    ) AS v("name", "position", "color", "is_terminal");

-- 4. Add nullable column_id and backfill from status -> the matching column of the
--    task's project board (status is still the TaskStatus enum here; dropped in step 6).
ALTER TABLE "tasks" ADD COLUMN "column_id" BIGINT;
UPDATE "tasks" t SET "column_id" = bc."id"
    FROM "board_columns" bc
    JOIN "boards" b ON b."id" = bc."board_id"
    WHERE b."project_id" = t."project_id"
      AND bc."position" = CASE t."status"
            WHEN 'todo'        THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'review'      THEN 2
            WHEN 'done'        THEN 3
          END;

-- 5. Tighten constraints, swap indexes, make project_id optional, wire the FKs.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_fkey";
DROP INDEX "tasks_project_id_status_position_idx";
ALTER TABLE "tasks" ALTER COLUMN "column_id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;
CREATE INDEX "tasks_column_id_position_idx" ON "tasks"("column_id", "position");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_fkey"
    FOREIGN KEY ("column_id") REFERENCES "board_columns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Drop the old enum column + type.
ALTER TABLE "tasks" DROP COLUMN "status";
DROP TYPE "TaskStatus";
