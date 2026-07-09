-- CreateTable
CREATE TABLE "time_entries" (
    "id" BIGSERIAL NOT NULL,
    "task_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "description" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_task_id_idx" ON "time_entries"("task_id");

-- CreateIndex
CREATE INDEX "time_entries_user_id_ended_at_idx" ON "time_entries"("user_id", "ended_at");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
