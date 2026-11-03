-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "ticker" TEXT,
    "cik" TEXT,
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

-- CreateTable
CREATE TABLE "AccountPracticeStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "AccountPracticeStatus_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "buyingRole" TEXT NOT NULL,
    "displayName" TEXT,
    "reportsToId" TEXT,
    "engagement" TEXT NOT NULL DEFAULT 'None',
    CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "practiceAreas" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "signalId" TEXT,
    "confidence" REAL NOT NULL,
    CONSTRAINT "Initiative_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TechStackHypothesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    CONSTRAINT "TechStackHypothesis_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signal" (
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

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "closeDate" DATETIME NOT NULL,
    "probability" INTEGER NOT NULL,
    "forecastCategory" TEXT NOT NULL,
    "nextStep" TEXT,
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

-- CreateTable
CREATE TABLE "StageChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StageChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Play" (
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
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "playId" TEXT,
    "status" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Campaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campaign_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Touch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "angle" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "outcome" TEXT,
    "sourceSignalId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Touch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Touch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "location" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "persona" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventInvite_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internalOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adapterId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "ok" BOOLEAN NOT NULL,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "JobRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HttpCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "etag" TEXT,
    "fetchedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outputPath" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SandboxScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "spec" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Account_tier_idx" ON "Account"("tier");

-- CreateIndex
CREATE INDEX "Account_name_idx" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccountPracticeStatus_accountId_practiceArea_key" ON "AccountPracticeStatus"("accountId", "practiceArea");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Initiative_accountId_idx" ON "Initiative"("accountId");

-- CreateIndex
CREATE INDEX "TechStackHypothesis_accountId_idx" ON "TechStackHypothesis"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_dedupeHash_key" ON "Signal"("dedupeHash");

-- CreateIndex
CREATE INDEX "Signal_accountId_publishedAt_idx" ON "Signal"("accountId", "publishedAt");

-- CreateIndex
CREATE INDEX "Signal_publishedAt_idx" ON "Signal"("publishedAt");

-- CreateIndex
CREATE INDEX "Signal_relevance_idx" ON "Signal"("relevance");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "Opportunity_closeDate_idx" ON "Opportunity"("closeDate");

-- CreateIndex
CREATE INDEX "Opportunity_accountId_idx" ON "Opportunity"("accountId");

-- CreateIndex
CREATE INDEX "StageChange_opportunityId_idx" ON "StageChange"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Play_slug_key" ON "Play"("slug");

-- CreateIndex
CREATE INDEX "Touch_accountId_scheduledAt_idx" ON "Touch"("accountId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Touch_scheduledAt_idx" ON "Touch"("scheduledAt");

-- CreateIndex
CREATE INDEX "AccountPlanItem_accountId_idx" ON "AccountPlanItem"("accountId");

-- CreateIndex
CREATE INDEX "Note_entityType_entityId_idx" ON "Note"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedView_scope_name_key" ON "SavedView"("scope", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardLayout_name_key" ON "DashboardLayout"("name");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "SourceRun_adapterId_startedAt_idx" ON "SourceRun"("adapterId", "startedAt");

-- CreateIndex
CREATE INDEX "JobRequest_status_idx" ON "JobRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExportTemplate_name_key" ON "ExportTemplate"("name");
