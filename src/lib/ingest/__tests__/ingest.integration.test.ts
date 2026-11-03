import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NormalizedSignal } from "@/lib/adapters/types";
import { ingestSignals } from "../ingest";

let db: PrismaClient;
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "acc-ingest-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" },
    stdio: "ignore",
  });
  db = new PrismaClient({ datasourceUrl: url });
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const sig = (o: Partial<NormalizedSignal>): NormalizedSignal => ({
  accountId: "real",
  type: "hiring",
  title: "Acme hiring 8 roles related to AI Infrastructure",
  summary: "GPU engineers",
  url: "https://jobs.example.com/acme",
  source: "greenhouse",
  publishedAt: new Date(),
  ...o,
});

describe("ingestSignals (integration)", () => {
  it("tags, scores, dedupes, derives evidence under the real-account policy, and alerts", async () => {
    await db.account.createMany({
      data: [
        { id: "real", name: "Acme Corp", industry: "Tech", tier: "Strategic", isDemo: false },
        {
          id: "demo",
          name: "Halvorsen Mutual",
          industry: "Insurance",
          tier: "Maintain",
          isDemo: true,
        },
      ],
    });
    const evidence = [
      {
        kind: "initiative" as const,
        title: "AI Infrastructure build-out (hiring evidence)",
        description: "8 roles",
        practiceAreas: ["ai-infra"],
        confidence: 0.6,
      },
    ];
    const r1 = await ingestSignals(db, [
      sig({ evidence }),
      sig({ url: "https://jobs.example.com/acme?utm_source=x" }), // duplicate after URL normalization
      sig({ title: "x" }), // invalid (too short)
      sig({ accountId: "missing" }), // unknown account
      sig({
        accountId: "real",
        title: "Acme hit by ransomware incident",
        type: "incident",
        url: null,
        source: "rss-news",
        evidence: [
          {
            kind: "tech",
            category: "Security",
            technology: "SIEM",
            evidence: "x",
            confidence: 0.5,
          },
        ],
      }),
    ]);
    expect(r1).toMatchObject({ received: 5, inserted: 2, duplicates: 1, invalid: 2 });

    const stored = await db.signal.findMany({ orderBy: { title: "asc" } });
    const hiring = stored.find((s) => s.type === "hiring")!;
    expect(hiring.practiceTags).toEqual(["ai-infra"]);
    expect(hiring.tagIndex).toBe(",ai-infra,");
    expect(hiring.relevance).toBeGreaterThan(50);

    // Evidence: initiative derived WITH a public URL is stored; tech evidence from a URL-less signal on a real account is rejected.
    const inits = await db.initiative.findMany({ where: { accountId: "real" } });
    expect(inits).toHaveLength(1);
    expect(inits[0]).toMatchObject({
      source: "job-post",
      sourceUrl: "https://jobs.example.com/acme",
    });
    expect(await db.techStackHypothesis.count({ where: { accountId: "real" } })).toBe(0);

    // Strategic + high relevance ⇒ notification.
    expect(r1.alerts).toBeGreaterThanOrEqual(1);
    expect(await db.notification.count()).toBe(r1.alerts);

    // Re-ingesting the same batch is a no-op.
    const r2 = await ingestSignals(db, [sig({})]);
    expect(r2).toMatchObject({ inserted: 0, duplicates: 1 });
  });
});
