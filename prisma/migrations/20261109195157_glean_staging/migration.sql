-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "StagedImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "origin" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "payload" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExternalRef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ExternalRef" ("createdAt", "entityId", "entityType", "externalId", "id", "system") SELECT "createdAt", "entityId", "entityType", "externalId", "id", "system" FROM "ExternalRef";
DROP TABLE "ExternalRef";
ALTER TABLE "new_ExternalRef" RENAME TO "ExternalRef";
CREATE INDEX "ExternalRef_entityType_entityId_idx" ON "ExternalRef"("entityType", "entityId");
CREATE UNIQUE INDEX "ExternalRef_system_entityType_externalId_key" ON "ExternalRef"("system", "entityType", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StagedImport_status_createdAt_idx" ON "StagedImport"("status", "createdAt");
