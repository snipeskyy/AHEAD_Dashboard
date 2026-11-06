import { describe, expect, it } from "vitest";
import { clusterCandidates, nameSimilarity, pickDefault, scoreCandidate } from "../identity";
import { enrichStatus } from "../status";

describe("identity resolution scoring", () => {
  it("measures name similarity on normalized legal names", () => {
    expect(nameSimilarity("Example Holdings, Inc.", "EXAMPLE HOLDINGS")).toBe(1);
    expect(nameSimilarity("Example Holdings", "Example Logistics")).toBeCloseTo(0.5); // "holdings" is a legal suffix
  });
  it("clusters candidates that share identifiers and boosts corroborated, domain-matching ones", () => {
    const merged = clusterCandidates([
      {
        label: "EXAMPLE CORP",
        facts: ["SEC registrant"],
        identifiers: { cik: "0000000001", ticker: "EXC" },
        sources: [{ source: "SEC", url: "s" }],
      },
      {
        label: "Example Corp",
        facts: ["Springfield"],
        identifiers: { wikidataId: "Q1", cik: "0000000001", domain: "example.com" },
        sources: [{ source: "Wikidata", url: "w" }],
      },
      {
        label: "Example Corp Ltd",
        facts: ["UK"],
        identifiers: { lei: "L1" },
        sources: [{ source: "GLEIF", url: "g" }],
      },
    ]);
    expect(merged).toHaveLength(2);
    const scored = merged
      .map((c) => scoreCandidate(c, { name: "Example Corp", domain: "example.com", ticker: null }))
      .sort((a, b) => b.score - a.score);
    expect(scored[0].identifiers).toMatchObject({
      cik: "0000000001",
      wikidataId: "Q1",
      domain: "example.com",
    });
    expect(scored[0].reasons).toEqual(
      expect.arrayContaining(["Website matches the account domain", "Confirmed by 2 sources"]),
    );
    expect(pickDefault(scored)).toBe(scored[0].key);
  });
  it("asks the user when two candidates are close", () => {
    const a = scoreCandidate(
      {
        label: "Acme",
        facts: [],
        identifiers: { lei: "A" },
        sources: [{ source: "GLEIF", url: "a" }],
      },
      { name: "Acme" },
    );
    const b = scoreCandidate(
      {
        label: "Acme",
        facts: [],
        identifiers: { lei: "B" },
        sources: [{ source: "GLEIF", url: "b" }],
      },
      { name: "Acme" },
    );
    expect(pickDefault([a, b])).toBeNull();
  });
});

describe("enrichment status", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const ttl = { website: 30, "sec-edgar": 1 };
  const run = (id: string, daysAgo: number, ok = true) => ({
    enricherId: id,
    ok,
    finishedAt: new Date(now.getTime() - daysAgo * 86_400_000),
  });
  it("covers every state", () => {
    expect(enrichStatus({ job: null, runs: [], pending: 0, ttlDays: ttl, now })).toBe(
      "not-enriched",
    );
    expect(
      enrichStatus({ job: { status: "queued" }, runs: [], pending: 0, ttlDays: ttl, now }),
    ).toBe("queued");
    expect(
      enrichStatus({
        job: { status: "running" },
        runs: [run("website", 0)],
        pending: 0,
        ttlDays: ttl,
        now,
      }),
    ).toBe("running");
    expect(
      enrichStatus({ job: null, runs: [run("website", 1)], pending: 3, ttlDays: ttl, now }),
    ).toBe("review");
    expect(
      enrichStatus({
        job: null,
        runs: [run("website", 1), run("sec-edgar", 0.5)],
        pending: 0,
        ttlDays: ttl,
        now,
      }),
    ).toBe("up-to-date");
    expect(
      enrichStatus({ job: null, runs: [run("sec-edgar", 3)], pending: 0, ttlDays: ttl, now }),
    ).toBe("stale");
    expect(
      enrichStatus({ job: null, runs: [run("website", 1, false)], pending: 0, ttlDays: ttl, now }),
    ).toBe("failed");
  });
});
