-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN "groupId" TEXT;

-- CreateTable
CREATE TABLE "ExternalRef" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ExternalRef_entityType_entityId_idx" ON "ExternalRef"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_system_entityType_externalId_key" ON "ExternalRef"("system", "entityType", "externalId");
