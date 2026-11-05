-- AlterTable
ALTER TABLE "JobRequest" ADD COLUMN "finishedAt" DATETIME;
ALTER TABLE "JobRequest" ADD COLUMN "result" JSONB;
