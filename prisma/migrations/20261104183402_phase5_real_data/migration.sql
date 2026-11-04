-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "fileName" TEXT,
    "inputType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "counts" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" DATETIME
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerRep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerCompany" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "territory" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerRepAccount" (
    "repId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    PRIMARY KEY ("repId", "accountId"),
    CONSTRAINT "PartnerRepAccount_repId_fkey" FOREIGN KEY ("repId") REFERENCES "PartnerRep" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerRepAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "targetPersonas" JSONB NOT NULL,
    "triggerKeywords" JSONB NOT NULL,
    "triggerSignalTypes" JSONB NOT NULL,
    "valueHypothesis" TEXT NOT NULL,
    "talkTrack" JSONB NOT NULL,
    "sequence" JSONB NOT NULL,
    "assetsNeeded" JSONB NOT NULL,
    "successMetrics" JSONB NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'user',
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Play" ("assetsNeeded", "id", "isDemo", "name", "practiceArea", "sequence", "slug", "successMetrics", "talkTrack", "targetPersonas", "triggerKeywords", "triggerSignalTypes", "valueHypothesis") SELECT "assetsNeeded", "id", "isDemo", "name", "practiceArea", "sequence", "slug", "successMetrics", "talkTrack", "targetPersonas", "triggerKeywords", "triggerSignalTypes", "valueHypothesis" FROM "Play";
DROP TABLE "Play";
ALTER TABLE "new_Play" RENAME TO "Play";
CREATE UNIQUE INDEX "Play_slug_key" ON "Play"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImportRecord_batchId_idx" ON "ImportRecord"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_kind_name_key" ON "ImportMapping"("kind", "name");

-- CreateIndex
CREATE INDEX "PartnerRep_partnerCompany_idx" ON "PartnerRep"("partnerCompany");
