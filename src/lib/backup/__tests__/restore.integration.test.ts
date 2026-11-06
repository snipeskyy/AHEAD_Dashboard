import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;
let db: PrismaClient;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "acc-restore-"));
  const url = `file:${path.join(dir, "acc.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" }, stdio: "ignore" });
  process.env.DATABASE_URL = url;
  db = (await import("@/lib/db")).db;
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("backup → restore (integration)", () => {
  it("restores every row exactly, including relations, dates and null JSON", async () => {
    const { snapshotAll } = await import("../snapshot");
    const { restoreBackup, parseBackup } = await import("../restore");
    const a = await db.account.create({ data: { name: "Example Restore Co", domain: "restore.example", industry: "Unclassified", tier: "Growth", sourceConfig: { googleNews: false } } });
    await db.contact.create({ data: { accountId: a.id, title: "CIO", function: "IT", seniority: "C-Level", buyingRole: "EconomicBuyer" } });
    await db.note.create({ data: { entityType: "account", entityId: a.id, body: "keep me", tags: undefined } });
    const opp = await db.opportunity.create({
      data: { accountId: a.id, name: "Restore deal", practiceArea: "cloud", stage: "Qualify", amount: 1000, closeDate: new Date("2027-01-15"), probability: 20, forecastCategory: "Pipeline", meddpicc: {}, partners: [], competitors: [], stageChangedAt: new Date() },
    });
    await db.stageChange.create({ data: { opportunityId: opp.id, fromStage: null, toStage: "Qualify", changedAt: new Date() } });
    const snap = JSON.parse(JSON.stringify(await snapshotAll(db)));

    await db.account.deleteMany({});
    await db.note.deleteMany({});
    await db.account.create({ data: { name: "Should vanish", industry: "x", tier: "Maintain" } });

    const restored = await restoreBackup(db, parseBackup(snap));
    expect(restored).toMatchObject({ accounts: 1, contacts: 1, notes: 1, opportunities: 1, stageChanges: 1 });
    const back = await db.account.findMany({ include: { contacts: true, opportunities: true } });
    expect(back.map((x) => x.name)).toEqual(["Example Restore Co"]);
    expect(back[0].id).toBe(a.id);
    expect(back[0].opportunities[0].closeDate.toISOString()).toBe("2027-01-15T00:00:00.000Z");
    expect((await db.note.findFirstOrThrow()).tags).toBeNull();
  }, 60_000);
});
