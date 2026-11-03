-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "source" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "practiceTags" JSONB NOT NULL,
    "tagIndex" TEXT NOT NULL DEFAULT '',
    "relevance" REAL NOT NULL,
    "relevanceParts" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "inNextSummary" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Signal" ("accountId", "createdAt", "dedupeHash", "dismissed", "id", "inNextSummary", "isDemo", "practiceTags", "publishedAt", "read", "relevance", "relevanceParts", "source", "starred", "summary", "title", "type", "url") SELECT "accountId", "createdAt", "dedupeHash", "dismissed", "id", "inNextSummary", "isDemo", "practiceTags", "publishedAt", "read", "relevance", "relevanceParts", "source", "starred", "summary", "title", "type", "url" FROM "Signal";
DROP TABLE "Signal";
ALTER TABLE "new_Signal" RENAME TO "Signal";
CREATE UNIQUE INDEX "Signal_dedupeHash_key" ON "Signal"("dedupeHash");
CREATE INDEX "Signal_accountId_publishedAt_idx" ON "Signal"("accountId", "publishedAt");
CREATE INDEX "Signal_publishedAt_idx" ON "Signal"("publishedAt");
CREATE INDEX "Signal_relevance_idx" ON "Signal"("relevance");
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");
CREATE INDEX "Signal_source_idx" ON "Signal"("source");
CREATE INDEX "Signal_type_idx" ON "Signal"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill tagIndex from the JSON practiceTags array (",tag1,tag2,").
UPDATE "Signal" SET "tagIndex" = COALESCE(',' || (SELECT group_concat(value, ',') FROM json_each("Signal"."practiceTags")) || ',', '');
