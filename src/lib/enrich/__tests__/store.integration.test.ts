import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptProposal, recordResult, rejectProposal, setManualValue } from "../store";

let db: PrismaClient;
let dir: string;
let accountId: string;
const now = new Date("2026-11-05T12:00:00Z");

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "acc-enrich-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" },
    stdio: "ignore",
  });
  db = new PrismaClient({ datasourceUrl: url });
  accountId = (
    await db.account.create({
      data: { name: "Example Holdings", industry: "Unclassified", tier: "Strategic" },
    })
  ).id;
}, 120_000);
afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const run = (proposals: Parameters<typeof recordResult>[4]["proposals"], autoApply = true) =>
  recordResult(db, accountId, "test-src", "Test source", { proposals }, { autoApply, now });

describe("enrichment store (integration)", () => {
  it("auto-applies high-confidence values to empty fields, mirrors columns, keeps the rest for review", async () => {
    const r = await run([
      {
        field: "firmographics.employeeCount",
        value: 12000,
        sourceUrl: "https://x.example/1",
        confidence: "high",
      },
      {
        field: "financials.fiscalYearEnd",
        value: "0630",
        sourceUrl: "https://x.example/2",
        confidence: "high",
      },
      {
        field: "firmographics.industry",
        value: "Insurance",
        sourceUrl: "https://x.example/3",
        confidence: "medium",
      },
      {
        field: "web.jobBoard",
        value: { provider: "lever", slug: "example" },
        sourceUrl: "https://x.example/4",
        confidence: "high",
      },
    ]);
    expect(r).toEqual({ applied: 3, pending: 1 });
    const a = await db.account.findUniqueOrThrow({ where: { id: accountId } });
    expect(a).toMatchObject({
      employeeBand: "10k–25k",
      fiscalYearEnd: "0630",
      industry: "Unclassified",
    });
    expect((a.sourceConfig as { leverSlug: string }).leverSlug).toBe("example");
    expect(await db.accountFieldHistory.count({ where: { accountId } })).toBe(3);
  });

  it("re-running supersedes the enricher's older pending proposal and skips unchanged values", async () => {
    const r = await run([
      {
        field: "firmographics.industry",
        value: "Insurance carriers",
        sourceUrl: "https://x.example/3",
        confidence: "medium",
      },
      {
        field: "firmographics.employeeCount",
        value: 12000,
        sourceUrl: "https://x.example/1",
        confidence: "high",
      },
    ]);
    expect(r).toEqual({ applied: 0, pending: 1 });
    expect(
      await db.fieldProposal.count({
        where: { accountId, field: "firmographics.industry", status: "pending" },
      }),
    ).toBe(1);
  });

  it("user edits lock a field; enrichment then only offers a hint", async () => {
    await setManualValue(db, accountId, "firmographics.employeeCount", 15000);
    const f = await db.accountField.findUniqueOrThrow({
      where: { accountId_field: { accountId, field: "firmographics.employeeCount" } },
    });
    expect(f).toMatchObject({ locked: true, confidence: "user", source: "user" });
    await run([
      {
        field: "firmographics.employeeCount",
        value: 13000,
        sourceUrl: "https://x.example/1",
        confidence: "high",
      },
    ]);
    expect((await db.accountField.findUniqueOrThrow({ where: { id: f.id } })).value).toBe(15000);
    expect(
      await db.fieldProposal.count({
        where: { accountId, field: "firmographics.employeeCount", status: "pending" },
      }),
    ).toBe(1);
  });

  it("accepting makes a value user-verified; list items become records; rejected items aren't re-proposed", async () => {
    const p = await db.fieldProposal.findFirstOrThrow({
      where: { accountId, field: "firmographics.industry", status: "pending" },
    });
    await acceptProposal(db, p.id, now);
    const f = await db.accountField.findUniqueOrThrow({
      where: { accountId_field: { accountId, field: "firmographics.industry" } },
    });
    expect(f.confidence).toBe("verified");
    expect((await db.account.findUniqueOrThrow({ where: { id: accountId } })).industry).toBe(
      "Insurance carriers",
    );

    await run([
      {
        field: "evidence.initiative:ai",
        value: {
          title: "AI and accelerated computing",
          practiceAreas: ["ai-infra"],
          section: "10-K Item 1",
          kind: "filing",
        },
        sourceUrl: "https://www.sec.gov/x",
        confidence: "high",
        evidenceSnippet: "We are investing in generative AI.",
      },
      {
        field: "contact:0001",
        value: { name: "Avery Quill", title: "Chief Executive Officer" },
        sourceUrl: "https://www.sec.gov/y",
        confidence: "high",
      },
      {
        field: "tech:Email:Microsoft 365",
        value: { category: "Email", technology: "Microsoft 365", kind: "dns" },
        sourceUrl: "https://dns.google/q",
        confidence: "high",
      },
    ]);
    const pend = await db.fieldProposal.findMany({
      where: { accountId, status: "pending", field: { contains: ":" } },
    });
    expect(pend).toHaveLength(3); // list items are never auto-applied
    for (const x of pend.filter((x) => !x.field.startsWith("tech:")))
      await acceptProposal(db, x.id, now);
    await rejectProposal(db, pend.find((x) => x.field.startsWith("tech:"))!.id, now);
    expect(await db.initiative.findFirst({ where: { accountId } })).toMatchObject({
      source: "filing",
      sourceUrl: "https://www.sec.gov/x",
      evidence: "We are investing in generative AI.",
    });
    expect(await db.contact.findFirst({ where: { accountId } })).toMatchObject({
      displayName: "Avery Quill",
      seniority: "C-Level",
      source: "test-src",
    });
    await run([
      {
        field: "tech:Email:Microsoft 365",
        value: { category: "Email", technology: "Microsoft 365", kind: "dns" },
        sourceUrl: "https://dns.google/q",
        confidence: "high",
      },
    ]);
    expect(
      await db.fieldProposal.count({
        where: { accountId, field: "tech:Email:Microsoft 365", status: "pending" },
      }),
    ).toBe(0);
  });

  it("stores financial facts and corporate relations idempotently", async () => {
    const res = {
      proposals: [],
      financials: [
        {
          metric: "capex" as const,
          fiscalYear: 2026,
          periodEnd: new Date("2026-06-30"),
          value: 4.2e8,
          unit: "USD",
          sourceUrl: "s",
        },
      ],
      relations: [
        {
          relation: "subsidiary" as const,
          name: "Example Sub LLC",
          source: "GLEIF",
          sourceUrl: "g",
        },
      ],
    };
    await recordResult(db, accountId, "t", "T", res, { autoApply: true, now });
    await recordResult(db, accountId, "t", "T", res, { autoApply: true, now });
    expect(await db.financialFact.count({ where: { accountId } })).toBe(1);
    expect(await db.corporateRelation.count({ where: { accountId } })).toBe(1);
  });
});
