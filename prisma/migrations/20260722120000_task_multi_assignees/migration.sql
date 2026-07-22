-- Task assignees: single `assignee_id` FK -> implicit m2m `_TaskAssignees` (like `_LabelToTask`).
-- Backfills the pivot from existing single assignees BEFORE dropping the column, so no data is lost.

-- CreateTable
CREATE TABLE "_TaskAssignees" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- AddForeignKey  (A -> tasks, B -> users; models ordered alphabetically Task < User)
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: carry each existing single assignee into the pivot.
INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "id", "assignee_id" FROM "tasks" WHERE "assignee_id" IS NOT NULL;

-- Drop the old single-assignee column + its FK.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_fkey";
ALTER TABLE "tasks" DROP COLUMN "assignee_id";

-- Enable RLS on the new pivot, matching every other table (see 20260710092608_enable_row_level_security).
ALTER TABLE "public"."_TaskAssignees" ENABLE ROW LEVEL SECURITY;
