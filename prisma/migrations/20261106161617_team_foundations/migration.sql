-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "role" TEXT NOT NULL DEFAULT 'associate-client-director',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountId" TEXT,
    "body" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT [],
    "authorId" TEXT NOT NULL DEFAULT 'local',
    "authorName" TEXT,
    "parentId" TEXT,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "ticker" TEXT,
    "cik" TEXT,
    "lei" TEXT,
    "wikidataId" TEXT,
    "identityConfirmedAt" DATETIME,
    "fiscalYearEnd" TEXT,
    "industry" TEXT NOT NULL,
    "subIndustry" TEXT,
    "hq" TEXT,
    "employeeBand" TEXT,
    "revenueBand" TEXT,
    "tier" TEXT NOT NULL,
    "ownerNotes" TEXT,
    "healthScore" REAL NOT NULL DEFAULT 0,
    "whitespaceScore" REAL NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "sourceConfig" JSONB,
    "lastTouchAt" DATETIME,
    "nextTouchAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Account" ("cik", "createdAt", "domain", "employeeBand", "fiscalYearEnd", "healthScore", "hq", "id", "identityConfirmedAt", "industry", "isDemo", "lastTouchAt", "lei", "name", "nextTouchAt", "ownerNotes", "revenueBand", "sourceConfig", "subIndustry", "ticker", "tier", "updatedAt", "whitespaceScore", "wikidataId") SELECT "cik", "createdAt", "domain", "employeeBand", "fiscalYearEnd", "healthScore", "hq", "id", "identityConfirmedAt", "industry", "isDemo", "lastTouchAt", "lei", "name", "nextTouchAt", "ownerNotes", "revenueBand", "sourceConfig", "subIndustry", "ticker", "tier", "updatedAt", "whitespaceScore", "wikidataId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_tier_idx" ON "Account"("tier");
CREATE INDEX "Account_name_idx" ON "Account"("name");
CREATE TABLE "new_AccountPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parentId" TEXT,
    "text" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AccountPlanItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AccountPlanItem" ("accountId", "dueDate", "id", "kind", "owner", "parentId", "sortOrder", "status", "text") SELECT "accountId", "dueDate", "id", "kind", "owner", "parentId", "sortOrder", "status", "text" FROM "AccountPlanItem";
DROP TABLE "AccountPlanItem";
ALTER TABLE "new_AccountPlanItem" RENAME TO "AccountPlanItem";
CREATE INDEX "AccountPlanItem_accountId_idx" ON "AccountPlanItem"("accountId");
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "playId" TEXT,
    "status" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Campaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campaign_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("accountId", "id", "isDemo", "name", "playId", "startDate", "status") SELECT "accountId", "id", "isDemo", "name", "playId", "startDate", "status" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "buyingRole" TEXT NOT NULL,
    "displayName" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "reportsToId" TEXT,
    "engagement" TEXT NOT NULL DEFAULT 'None',
    CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("accountId", "buyingRole", "displayName", "engagement", "function", "id", "reportsToId", "seniority", "source", "sourceUrl", "title") SELECT "accountId", "buyingRole", "displayName", "engagement", "function", "id", "reportsToId", "seniority", "source", "sourceUrl", "title" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");
CREATE TABLE "new_DashboardLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_DashboardLayout" ("id", "isDefault", "name", "sortOrder", "widgets") SELECT "id", "isDefault", "name", "sortOrder", "widgets" FROM "DashboardLayout";
DROP TABLE "DashboardLayout";
ALTER TABLE "new_DashboardLayout" RENAME TO "DashboardLayout";
CREATE UNIQUE INDEX "DashboardLayout_name_key" ON "DashboardLayout"("name");
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "location" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Event" ("id", "isDemo", "kind", "location", "name", "startsAt") SELECT "id", "isDemo", "kind", "location", "name", "startsAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_ExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outputPath" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ExportJob" ("config", "createdAt", "format", "id", "outputPath", "status", "templateId", "title", "version") SELECT "config", "createdAt", "format", "id", "outputPath", "status", "templateId", "title", "version" FROM "ExportJob";
DROP TABLE "ExportJob";
ALTER TABLE "new_ExportJob" RENAME TO "ExportJob";
CREATE TABLE "new_ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "kind" TEXT NOT NULL,
    "fileName" TEXT,
    "inputType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "counts" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" DATETIME
);
INSERT INTO "new_ImportBatch" ("counts", "createdAt", "fileName", "id", "inputType", "kind", "status", "undoneAt") SELECT "counts", "createdAt", "fileName", "id", "inputType", "kind", "status", "undoneAt" FROM "ImportBatch";
DROP TABLE "ImportBatch";
ALTER TABLE "new_ImportBatch" RENAME TO "ImportBatch";
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");
CREATE TABLE "new_Initiative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "practiceAreas" JSONB NOT NULL,
    "evidence" TEXT,
    "section" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "signalId" TEXT,
    "confidence" REAL NOT NULL,
    CONSTRAINT "Initiative_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Initiative" ("accountId", "confidence", "description", "evidence", "id", "practiceAreas", "section", "signalId", "source", "sourceUrl", "title") SELECT "accountId", "confidence", "description", "evidence", "id", "practiceAreas", "section", "signalId", "source", "sourceUrl", "title" FROM "Initiative";
DROP TABLE "Initiative";
ALTER TABLE "new_Initiative" RENAME TO "Initiative";
CREATE INDEX "Initiative_accountId_idx" ON "Initiative"("accountId");
CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "uid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME,
    "location" TEXT,
    "attendeeDomains" JSONB NOT NULL,
    "accountId" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("accountId", "attendeeDomains", "endsAt", "id", "importedAt", "location", "startsAt", "title", "uid") SELECT "accountId", "attendeeDomains", "endsAt", "id", "importedAt", "location", "startsAt", "title", "uid" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");
CREATE UNIQUE INDEX "Meeting_uid_startsAt_key" ON "Meeting"("uid", "startsAt");
CREATE TABLE "new_Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internalOnly" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Note" ("body", "createdAt", "entityId", "entityType", "id", "internalOnly", "tags", "updatedAt") SELECT "body", "createdAt", "entityId", "entityType", "id", "internalOnly", "tags", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_entityType_entityId_idx" ON "Note"("entityType", "entityId");
CREATE TABLE "new_Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "closeDate" DATETIME NOT NULL,
    "probability" INTEGER NOT NULL,
    "forecastCategory" TEXT NOT NULL,
    "nextStep" TEXT,
    "nextStepDate" DATETIME,
    "meddpicc" JSONB NOT NULL,
    "partners" JSONB NOT NULL,
    "competitors" JSONB NOT NULL,
    "closeDatePushes" INTEGER NOT NULL DEFAULT 0,
    "stageChangedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "sourceSignalId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("accountId", "amount", "closeDate", "closeDatePushes", "closedAt", "competitors", "createdAt", "forecastCategory", "id", "isDemo", "meddpicc", "name", "nextStep", "nextStepDate", "partners", "practiceArea", "probability", "sourceSignalId", "stage", "stageChangedAt", "updatedAt") SELECT "accountId", "amount", "closeDate", "closeDatePushes", "closedAt", "competitors", "createdAt", "forecastCategory", "id", "isDemo", "meddpicc", "name", "nextStep", "nextStepDate", "partners", "practiceArea", "probability", "sourceSignalId", "stage", "stageChangedAt", "updatedAt" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_closeDate_idx" ON "Opportunity"("closeDate");
CREATE INDEX "Opportunity_accountId_idx" ON "Opportunity"("accountId");
CREATE TABLE "new_PartnerRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "partnerCompany" TEXT NOT NULL,
    "repId" TEXT,
    "accountId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerRegistration_repId_fkey" FOREIGN KEY ("repId") REFERENCES "PartnerRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartnerRegistration_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartnerRegistration_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PartnerRegistration" ("accountId", "createdAt", "expiresAt", "id", "notes", "opportunityId", "partnerCompany", "reference", "repId", "status") SELECT "accountId", "createdAt", "expiresAt", "id", "notes", "opportunityId", "partnerCompany", "reference", "repId", "status" FROM "PartnerRegistration";
DROP TABLE "PartnerRegistration";
ALTER TABLE "new_PartnerRegistration" RENAME TO "PartnerRegistration";
CREATE INDEX "PartnerRegistration_partnerCompany_idx" ON "PartnerRegistration"("partnerCompany");
CREATE TABLE "new_PartnerRep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "partnerCompany" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "territory" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PartnerRep" ("createdAt", "id", "name", "notes", "partnerCompany", "territory", "title", "updatedAt") SELECT "createdAt", "id", "name", "notes", "partnerCompany", "territory", "title", "updatedAt" FROM "PartnerRep";
DROP TABLE "PartnerRep";
ALTER TABLE "new_PartnerRep" RENAME TO "PartnerRep";
CREATE INDEX "PartnerRep_partnerCompany_idx" ON "PartnerRep"("partnerCompany");
CREATE TABLE "new_Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
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
INSERT INTO "new_Play" ("assetsNeeded", "id", "isDemo", "name", "origin", "practiceArea", "sequence", "slug", "successMetrics", "talkTrack", "targetPersonas", "triggerKeywords", "triggerSignalTypes", "valueHypothesis") SELECT "assetsNeeded", "id", "isDemo", "name", "origin", "practiceArea", "sequence", "slug", "successMetrics", "talkTrack", "targetPersonas", "triggerKeywords", "triggerSignalTypes", "valueHypothesis" FROM "Play";
DROP TABLE "Play";
ALTER TABLE "new_Play" RENAME TO "Play";
CREATE UNIQUE INDEX "Play_slug_key" ON "Play"("slug");
CREATE TABLE "new_SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL
);
INSERT INTO "new_SavedView" ("config", "id", "name", "scope") SELECT "config", "id", "name", "scope" FROM "SavedView";
DROP TABLE "SavedView";
ALTER TABLE "new_SavedView" RENAME TO "SavedView";
CREATE UNIQUE INDEX "SavedView_scope_name_key" ON "SavedView"("scope", "name");
CREATE TABLE "new_Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
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
    "triagedAt" DATETIME,
    "triageAction" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Signal" ("accountId", "createdAt", "dedupeHash", "dismissed", "id", "inNextSummary", "isDemo", "practiceTags", "publishedAt", "read", "relevance", "relevanceParts", "source", "starred", "summary", "tagIndex", "title", "triageAction", "triagedAt", "type", "url") SELECT "accountId", "createdAt", "dedupeHash", "dismissed", "id", "inNextSummary", "isDemo", "practiceTags", "publishedAt", "read", "relevance", "relevanceParts", "source", "starred", "summary", "tagIndex", "title", "triageAction", "triagedAt", "type", "url" FROM "Signal";
DROP TABLE "Signal";
ALTER TABLE "new_Signal" RENAME TO "Signal";
CREATE UNIQUE INDEX "Signal_dedupeHash_key" ON "Signal"("dedupeHash");
CREATE INDEX "Signal_accountId_publishedAt_idx" ON "Signal"("accountId", "publishedAt");
CREATE INDEX "Signal_publishedAt_idx" ON "Signal"("publishedAt");
CREATE INDEX "Signal_relevance_idx" ON "Signal"("relevance");
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");
CREATE INDEX "Signal_source_idx" ON "Signal"("source");
CREATE INDEX "Signal_type_idx" ON "Signal"("type");
CREATE TABLE "new_SmartList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SmartList" ("createdAt", "entity", "id", "name", "pinned", "rules", "sortOrder") SELECT "createdAt", "entity", "id", "name", "pinned", "rules", "sortOrder" FROM "SmartList";
DROP TABLE "SmartList";
ALTER TABLE "new_SmartList" RENAME TO "SmartList";
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "recurrence" TEXT,
    "accountId" TEXT,
    "opportunityId" TEXT,
    "signalId" TEXT,
    "contactId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("accountId", "completedAt", "contactId", "createdAt", "dueDate", "id", "notes", "opportunityId", "priority", "recurrence", "signalId", "source", "status", "title", "updatedAt") SELECT "accountId", "completedAt", "contactId", "createdAt", "dueDate", "id", "notes", "opportunityId", "priority", "recurrence", "signalId", "source", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE INDEX "Task_accountId_idx" ON "Task"("accountId");
CREATE TABLE "new_TechStackHypothesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
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
INSERT INTO "new_TechStackHypothesis" ("accountId", "category", "confidence", "evidence", "id", "source", "sourceUrl", "status", "technology") SELECT "accountId", "category", "confidence", "evidence", "id", "source", "sourceUrl", "status", "technology" FROM "TechStackHypothesis";
DROP TABLE "TechStackHypothesis";
ALTER TABLE "new_TechStackHypothesis" RENAME TO "TechStackHypothesis";
CREATE INDEX "TechStackHypothesis_accountId_idx" ON "TechStackHypothesis"("accountId");
CREATE TABLE "new_Touch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL DEFAULT 'local',
    "teamId" TEXT NOT NULL DEFAULT 'local-team',
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "updatedBy" TEXT NOT NULL DEFAULT 'local',
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "angle" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "outcome" TEXT,
    "sourceSignalId" TEXT,
    "partnerRepId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Touch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Touch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Touch" ("accountId", "angle", "campaignId", "channel", "completedAt", "id", "isDemo", "outcome", "partnerRepId", "persona", "scheduledAt", "sourceSignalId") SELECT "accountId", "angle", "campaignId", "channel", "completedAt", "id", "isDemo", "outcome", "partnerRepId", "persona", "scheduledAt", "sourceSignalId" FROM "Touch";
DROP TABLE "Touch";
ALTER TABLE "new_Touch" RENAME TO "Touch";
CREATE INDEX "Touch_accountId_scheduledAt_idx" ON "Touch"("accountId", "scheduledAt");
CREATE INDEX "Touch_scheduledAt_idx" ON "Touch"("scheduledAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
