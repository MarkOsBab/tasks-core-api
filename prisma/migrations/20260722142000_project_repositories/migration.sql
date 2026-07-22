-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "repositories" TEXT[] DEFAULT ARRAY[]::TEXT[];
