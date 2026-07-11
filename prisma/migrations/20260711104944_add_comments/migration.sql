-- CreateTable
CREATE TABLE "comments" (
    "id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_task_id_idx" ON "comments"("task_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS on the new table, matching every other table (see 20260710092608_enable_row_level_security).
-- Prisma runs as the table owner and bypasses RLS at runtime; this denies Supabase's PostgREST anon access.
ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;
