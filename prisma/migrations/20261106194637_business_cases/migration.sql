-- CreateTable
CREATE TABLE "BusinessCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "model" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BusinessCase_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessCaseVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "model" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessCaseVersion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "BusinessCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BusinessCase_accountId_idx" ON "BusinessCase"("accountId");

-- CreateIndex
CREATE INDEX "BusinessCase_opportunityId_idx" ON "BusinessCase"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCaseVersion_caseId_version_key" ON "BusinessCaseVersion"("caseId", "version");
