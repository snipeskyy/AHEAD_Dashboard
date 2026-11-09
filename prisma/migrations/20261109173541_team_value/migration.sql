-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "closeReason" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "assigneeId" TEXT;

-- CreateTable
CREATE TABLE "MutualActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "targetDate" DATETIME,
    "steps" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MutualActionPlan_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MutualActionPlan_opportunityId_key" ON "MutualActionPlan"("opportunityId");
