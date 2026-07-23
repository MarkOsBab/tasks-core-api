-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "via_agent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "via_agent" BOOLEAN NOT NULL DEFAULT false;
