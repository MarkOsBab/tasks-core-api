-- CreateTable
CREATE TABLE "checklist_items" (
    "id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_items_task_id_position_idx" ON "checklist_items"("task_id", "position");

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS on the new table, matching every other table (see 20260710092608_enable_row_level_security).
-- Prisma runs as the table owner and bypasses RLS at runtime; this denies Supabase's PostgREST anon access.
ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;
