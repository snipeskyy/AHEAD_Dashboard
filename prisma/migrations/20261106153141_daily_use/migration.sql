-- AlterTable
ALTER TABLE "Note" ADD COLUMN "tags" JSONB;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "nextStepDate" DATETIME;

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN "triageAction" TEXT;
ALTER TABLE "Signal" ADD COLUMN "triagedAt" DATETIME;

-- AlterTable
ALTER TABLE "Touch" ADD COLUMN "partnerRepId" TEXT;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateTable
CREATE TABLE "SmartList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OpportunityPartnerRep" (
    "opportunityId" TEXT NOT NULL,
    "repId" TEXT NOT NULL,

    PRIMARY KEY ("opportunityId", "repId"),
    CONSTRAINT "OpportunityPartnerRep_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityPartnerRep_repId_fkey" FOREIGN KEY ("repId") REFERENCES "PartnerRep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_accountId_idx" ON "Task"("accountId");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_uid_startsAt_key" ON "Meeting"("uid", "startsAt");

-- CreateIndex
CREATE INDEX "PartnerRegistration_partnerCompany_idx" ON "PartnerRegistration"("partnerCompany");
