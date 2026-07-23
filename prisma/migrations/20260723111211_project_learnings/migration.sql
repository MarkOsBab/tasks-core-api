-- CreateTable
CREATE TABLE "project_learnings" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "task_id" BIGINT,
    "body" VARCHAR(2000) NOT NULL,
    "created_by_id" BIGINT,
    "via_agent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_learnings_project_id_created_at_idx" ON "project_learnings"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_learnings" ADD CONSTRAINT "project_learnings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_learnings" ADD CONSTRAINT "project_learnings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_learnings" ADD CONSTRAINT "project_learnings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
