-- CreateTable
CREATE TABLE "labels" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LabelToTask" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_LabelToTask_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LabelToTask_B_index" ON "_LabelToTask"("B");

-- AddForeignKey
ALTER TABLE "_LabelToTask" ADD CONSTRAINT "_LabelToTask_A_fkey" FOREIGN KEY ("A") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabelToTask" ADD CONSTRAINT "_LabelToTask_B_fkey" FOREIGN KEY ("B") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS on the new tables, matching every other table (see 20260710092608_enable_row_level_security).
-- Prisma runs as the table owner and bypasses RLS at runtime; this denies Supabase's PostgREST anon access.
ALTER TABLE "public"."labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_LabelToTask" ENABLE ROW LEVEL SECURITY;
