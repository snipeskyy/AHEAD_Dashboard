-- AlterTable
ALTER TABLE "Account" ADD COLUMN "fiscalYearEnd" TEXT;
ALTER TABLE "Account" ADD COLUMN "identityConfirmedAt" DATETIME;
ALTER TABLE "Account" ADD COLUMN "lei" TEXT;
ALTER TABLE "Account" ADD COLUMN "wikidataId" TEXT;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "source" TEXT;
ALTER TABLE "Contact" ADD COLUMN "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "Initiative" ADD COLUMN "evidence" TEXT;
ALTER TABLE "Initiative" ADD COLUMN "section" TEXT;

-- CreateTable
CREATE TABLE "AccountField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidence" TEXT NOT NULL,
    "fetchedAt" DATETIME,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountField_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountFieldHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountFieldHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "enricherId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidenceSnippet" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fetchedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "FieldProposal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnrichmentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "enricherId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "proposals" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    CONSTRAINT "EnrichmentRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "enricherIds" JSONB,
    "force" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "EnrichmentJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'USD',
    "sourceUrl" TEXT NOT NULL,
    CONSTRAINT "FinancialFact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorporateRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lei" TEXT,
    "wikidataId" TEXT,
    "country" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "linkedAccountId" TEXT,
    CONSTRAINT "CorporateRelation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TechStackHypothesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'hypothesis',
    CONSTRAINT "TechStackHypothesis_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TechStackHypothesis" ("accountId", "category", "confidence", "evidence", "id", "source", "sourceUrl", "technology") SELECT "accountId", "category", "confidence", "evidence", "id", "source", "sourceUrl", "technology" FROM "TechStackHypothesis";
DROP TABLE "TechStackHypothesis";
ALTER TABLE "new_TechStackHypothesis" RENAME TO "TechStackHypothesis";
CREATE INDEX "TechStackHypothesis_accountId_idx" ON "TechStackHypothesis"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AccountField_accountId_field_key" ON "AccountField"("accountId", "field");

-- CreateIndex
CREATE INDEX "AccountFieldHistory_accountId_field_idx" ON "AccountFieldHistory"("accountId", "field");

-- CreateIndex
CREATE INDEX "FieldProposal_accountId_status_idx" ON "FieldProposal"("accountId", "status");

-- CreateIndex
CREATE INDEX "FieldProposal_accountId_field_idx" ON "FieldProposal"("accountId", "field");

-- CreateIndex
CREATE INDEX "EnrichmentRun_accountId_enricherId_startedAt_idx" ON "EnrichmentRun"("accountId", "enricherId", "startedAt");

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_createdAt_idx" ON "EnrichmentJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialFact_accountId_metric_periodEnd_key" ON "FinancialFact"("accountId", "metric", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateRelation_accountId_relation_name_key" ON "CorporateRelation"("accountId", "relation", "name");
