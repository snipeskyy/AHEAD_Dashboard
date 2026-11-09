-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SandboxScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountId" TEXT,
    "baseId" TEXT,
    "spec" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SandboxScenario" ("accountId", "createdAt", "id", "name", "spec") SELECT "accountId", "createdAt", "id", "name", "spec" FROM "SandboxScenario";
DROP TABLE "SandboxScenario";
ALTER TABLE "new_SandboxScenario" RENAME TO "SandboxScenario";
CREATE INDEX "SandboxScenario_accountId_idx" ON "SandboxScenario"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
