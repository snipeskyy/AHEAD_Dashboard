import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The import pipeline uses the app's db singleton, so point it at a throwaway DB before importing.
let dir: string;
let db: PrismaClient;
let plan: typeof import("../plan");
let commit: typeof import("../commit");
let undo: typeof import("../undo");
let purge: typeof import("@/lib/data/purge-demo");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "acc-import-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" },
    stdio: "ignore",
  });
  process.env.DATABASE_URL = url;
  db = (await import("@/lib/db")).db;
  plan = await import("../plan");
  commit = await import("../commit");
  undo = await import("../undo");
  purge = await import("@/lib/data/purge-demo");
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const accounts = (rows: Array<Record<string, string>>) =>
  commit.commitImport({ kind: "accounts", rows, decisions: {}, inputType: "paste" });

describe("import pipeline (integration)", () => {
  it("creates accounts, flags in-file and existing duplicates, and never auto-enables Google News", async () => {
    const r = await accounts([
      { name: "Example Holdings Inc.", domain: "example.com", tier: "Strategic" },
      { name: "Sample Logistics", domain: "" },
      { name: "Example Holdings", domain: "example.com" }, // same domain in file → skipped
      { name: "x" }, // invalid
    ]);
    expect(r.counts).toEqual({ created: 2, merged: 0, skipped: 1, errors: 1 });
    const a = await db.account.findFirstOrThrow({ where: { domain: "example.com" } });
    expect(a).toMatchObject({ tier: "Strategic", isDemo: false });
    expect((a.sourceConfig as { googleNews: boolean }).googleNews).toBe(false);
    expect(await db.accountPracticeStatus.count({ where: { accountId: a.id } })).toBeGreaterThan(0);

    const p = await plan.planImport("accounts", [
      { name: "EXAMPLE HOLDINGS, INC", domain: "", industry: "Insurance" }, // name match
      { name: "Other", domain: "example.com" }, // domain match wins
      { name: "Sample Logistics" }, // identical → nothing to merge
    ]);
    expect(p.map((x) => [x.row.status, x.row.match?.by, x.row.defaultDecision])).toEqual([
      ["duplicate", "name", "merge"],
      ["duplicate", "domain", "skip"],
      ["duplicate", "name", "skip"],
    ]);
    expect(p[0].row.diff).toEqual([
      { field: "industry", label: "Industry", current: "Unclassified", incoming: "Insurance" },
    ]);
  });

  it("merges only non-blank differing fields and undo restores them", async () => {
    const r = await accounts([
      { name: "Example Holdings", domain: "example.com", industry: "Insurance", tier: "" },
    ]);
    expect(r.counts.merged).toBe(1);
    const a = await db.account.findFirstOrThrow({ where: { domain: "example.com" } });
    expect(a).toMatchObject({ industry: "Insurance", tier: "Strategic" }); // blank tier didn't erase
    await undo.undoImport(r.batchId);
    expect((await db.account.findUniqueOrThrow({ where: { id: a.id } })).industry).toBe(
      "Unclassified",
    );
    await expect(undo.undoImport(r.batchId)).rejects.toThrow(/already undone/);
  });

  it("imports child records against existing accounts and reports unknown accounts", async () => {
    const opps = await commit.commitImport({
      kind: "opportunities",
      inputType: "csv",
      decisions: {},
      rows: [
        {
          account: "example.com",
          name: "GPU pilot",
          practiceArea: "AI Infrastructure",
          stage: "Discover",
          amount: "250k",
          closeDate: "2026-12-15",
        },
        {
          account: "Nobody Corp",
          name: "X",
          practiceArea: "Cloud",
          amount: "1",
          closeDate: "2026-12-15",
        },
      ],
    });
    expect(opps.counts).toMatchObject({ created: 1, errors: 1 });
    const o = await db.opportunity.findFirstOrThrow({
      where: { name: "GPU pilot" },
      include: { stageHistory: true },
    });
    expect(o).toMatchObject({ amount: 250_000, probability: 20, stage: "Discover" });
    expect(o.stageHistory).toHaveLength(1);

    const rep = await commit.commitImport({
      kind: "partner-reps",
      inputType: "csv",
      decisions: {},
      rows: [
        {
          partnerCompany: "Compute OEM A",
          name: "Sam Rivera",
          accounts: "example.com; Unknown Co",
        },
      ],
    });
    expect(rep.counts.created).toBe(1);
    expect(await db.partnerRepAccount.count()).toBe(1);
    const p = await plan.planImport("partner-reps", [
      { partnerCompany: "Compute OEM A", name: "Sam Rivera", accounts: "Unknown Co" },
    ]);
    expect(p[0].row.status).toBe("duplicate");
    expect(p[0].row.warnings[0]).toMatch(/Unknown Co/);
  });

  it("undoing an account import removes the accounts and what was added to them", async () => {
    const r = await accounts([{ name: "Undo Me Ltd", domain: "undo.example" }]);
    const id = r.createdAccounts[0];
    await db.contact.create({
      data: {
        accountId: id,
        title: "CIO",
        function: "IT",
        seniority: "C-Level",
        buyingRole: "EconomicBuyer",
      },
    });
    const impact = await undo.undoImpact(r.batchId);
    expect(impact.dependent.contacts).toBe(1);
    await undo.undoImport(r.batchId);
    expect(await db.account.count({ where: { id } })).toBe(0);
    expect(await db.contact.count({ where: { accountId: id } })).toBe(0);
  });

  it("purge removes demo rows only and keeps demo plays as Starter Plays", async () => {
    const demo = await db.account.create({
      data: { name: "Demo Co", industry: "X", tier: "Growth", isDemo: true },
    });
    await db.note.create({ data: { entityType: "account", entityId: demo.id, body: "demo note" } });
    await db.play.create({
      data: {
        slug: "demo-x",
        name: "Demo play",
        practiceArea: "cloud",
        targetPersonas: [],
        triggerKeywords: [],
        triggerSignalTypes: [],
        valueHypothesis: "v",
        talkTrack: [],
        sequence: [],
        assetsNeeded: [],
        successMetrics: [],
        isDemo: true,
      },
    });
    const real = await db.account.count({ where: { isDemo: false } });
    const r = await purge.purgeDemoData(db, { exportsDir: dir });
    expect(r.removed).toMatchObject({ accounts: 1, notes: 1 });
    expect(r.starterPlays).toBe(1);
    expect(await db.account.count()).toBe(real);
    expect(await db.play.findUniqueOrThrow({ where: { slug: "demo-x" } })).toMatchObject({
      isDemo: false,
      origin: "starter",
    });
    expect(purge.hasDemo(await purge.countDemo(db))).toBe(false);
  });
});
