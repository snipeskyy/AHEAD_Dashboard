import { describe, expect, it } from "vitest";
import { MEDDPICC_KEYS, type Meddpicc } from "@/lib/domain/enums";
import { dealRiskFlags } from "../deal-risk";
import { computeHealth, DEFAULT_HEALTH_WEIGHTS, type HealthInputs } from "../health";
import { emptyMeddpicc, meddpiccCompleteness, meddpiccRedFlags } from "../meddpicc";
import { computeRelevance, rescoreFromParts } from "../relevance";
import { computeWhitespace } from "../whitespace";

const DAY = 86_400_000;
const now = new Date("2026-06-01T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const meddpicc = (
  status: "unknown" | "partial" | "confirmed",
  overrides: Partial<
    Record<(typeof MEDDPICC_KEYS)[number], "unknown" | "partial" | "confirmed">
  > = {},
): Meddpicc =>
  Object.fromEntries(
    MEDDPICC_KEYS.map((k) => [k, { status: overrides[k] ?? status, notes: "" }]),
  ) as Meddpicc;

describe("health score", () => {
  const perfect: HealthInputs = {
    daysSinceLastTouch: 2,
    coreRolesCovered: 4,
    stageChangesLast30d: 5,
    relevantSignalsLast30d: 20,
    avgMeddpicc: 100,
    openOpps: 3,
    openOppsWithRisk: 0,
  };

  it("is 100 when every input is maxed and 0-ish when cold", () => {
    expect(computeHealth(perfect).value).toBe(100);
    const cold = computeHealth({
      daysSinceLastTouch: null,
      coreRolesCovered: 0,
      stageChangesLast30d: 0,
      relevantSignalsLast30d: 0,
      avgMeddpicc: 0,
      openOpps: 2,
      openOppsWithRisk: 2,
    });
    expect(cold.value).toBe(0);
  });

  it("components sum to the value and expose inputs", () => {
    const r = computeHealth({ ...perfect, daysSinceLastTouch: 48.5, coreRolesCovered: 2 });
    const sum = r.components.reduce((s, c) => s + c.contribution, 0);
    expect(Math.abs(sum - r.value)).toBeLessThan(0.3);
    expect(r.components.find((c) => c.id === "coverage")!.input).toBe("2 of 4 core roles");
    expect(r.components.find((c) => c.id === "engagement")!.score).toBeCloseTo(0.5, 2);
  });

  it("respects weights (normalized)", () => {
    const onlyCoverage = {
      ...Object.fromEntries(Object.keys(DEFAULT_HEALTH_WEIGHTS).map((k) => [k, 0])),
      coverage: 2,
    } as typeof DEFAULT_HEALTH_WEIGHTS;
    expect(computeHealth({ ...perfect, coreRolesCovered: 1 }, onlyCoverage).value).toBe(25);
  });

  it("treats no open opps as neutral quality and zero risk", () => {
    const r = computeHealth({ ...perfect, avgMeddpicc: null, openOpps: 0, openOppsWithRisk: 0 });
    expect(r.components.find((c) => c.id === "quality")!.score).toBe(0.5);
    expect(r.components.find((c) => c.id === "risk")!.score).toBe(1);
  });
});

describe("whitespace score", () => {
  it("is 100 when everything is un-engaged with maximal demand, 0 when all delivered", () => {
    const all = (status: "NotEngaged" | "Delivered", demand: number) =>
      ["a", "b", "c"].map((p) => ({ practiceArea: p, label: p, status, demand }));
    expect(computeWhitespace(all("NotEngaged", 1)).value).toBe(100);
    expect(computeWhitespace(all("Delivered", 1)).value).toBe(0);
  });
  it("weights practices", () => {
    const inputs = [
      { practiceArea: "a", label: "A", status: "NotEngaged" as const, demand: 0 },
      { practiceArea: "b", label: "B", status: "Delivered" as const, demand: 0 },
    ];
    expect(computeWhitespace(inputs, { a: 0, b: 1 }).value).toBe(0);
    expect(computeWhitespace(inputs, { a: 1, b: 0 }).value).toBeCloseTo(66.7, 1);
  });
});

describe("relevance score", () => {
  const base = { source: "sec-edgar", keywordHits: 2, tier: "Strategic", now };
  it("halves every half-life", () => {
    const fresh = computeRelevance({ ...base, publishedAt: now }).value;
    const week = computeRelevance({ ...base, publishedAt: ago(7) }).value;
    expect(fresh).toBe(100);
    expect(week).toBe(50);
  });
  it("multiplies source, practice match and tier", () => {
    const r = computeRelevance({
      ...base,
      publishedAt: now,
      source: "gdelt",
      keywordHits: 0,
      tier: "Maintain",
    });
    expect(r.parts).toMatchObject({ sourceWeight: 0.6, practiceMatch: 0.4, tierFactor: 0.6 });
    expect(r.value).toBeCloseTo(14.4, 1);
  });
  it("rescoreFromParts matches a fresh computation", () => {
    const r = computeRelevance({ ...base, publishedAt: ago(3), keywordHits: 1 });
    const later = new Date(now.getTime() + 4 * DAY);
    expect(rescoreFromParts(r.parts, ago(3), later).value).toBe(
      computeRelevance({ ...base, publishedAt: ago(3), keywordHits: 1, now: later }).value,
    );
  });
});

describe("MEDDPICC", () => {
  it("scores completeness 0 / 50 / 100", () => {
    expect(meddpiccCompleteness(emptyMeddpicc())).toBe(0);
    expect(meddpiccCompleteness(meddpicc("partial"))).toBe(50);
    expect(meddpiccCompleteness(meddpicc("confirmed"))).toBe(100);
  });
  it("raises stage-aware red flags", () => {
    expect(meddpiccRedFlags(meddpicc("confirmed"), "Negotiate")).toEqual([]);
    expect(
      meddpiccRedFlags(meddpicc("confirmed", { economicBuyer: "unknown" }), "Qualify"),
    ).toEqual(["No Economic Buyer identified"]);
    expect(meddpiccRedFlags(meddpicc("confirmed", { champion: "unknown" }), "Discover")).toEqual(
      [],
    );
    expect(
      meddpiccRedFlags(meddpicc("confirmed", { champion: "unknown" }), "Solution"),
    ).toHaveLength(1);
    expect(
      meddpiccRedFlags(meddpicc("confirmed", { paperProcess: "unknown" }), "Negotiate"),
    ).toEqual(["Paper Process unknown at Negotiate"]);
  });
});

describe("deal risk", () => {
  const ok = {
    stage: "Proposal" as const,
    stageChangedAt: ago(5),
    closeDate: ago(-30),
    closeDatePushes: 0,
    meddpicc: meddpicc("confirmed"),
  };
  it("flags nothing on a healthy deal or closed deals", () => {
    expect(dealRiskFlags(ok, now)).toEqual([]);
    expect(dealRiskFlags({ ...ok, stage: "ClosedLost", closeDatePushes: 5 }, now)).toEqual([]);
  });
  it("flags each heuristic", () => {
    expect(dealRiskFlags({ ...ok, stageChangedAt: ago(45) }, now)).toEqual(["stalled"]);
    expect(dealRiskFlags({ ...ok, stageChangedAt: ago(45) }, now, 60)).toEqual([]);
    expect(dealRiskFlags({ ...ok, closeDatePushes: 2 }, now)).toEqual(["pushed"]);
    expect(
      dealRiskFlags({ ...ok, meddpicc: meddpicc("confirmed", { economicBuyer: "unknown" }) }, now),
    ).toEqual(["no-economic-buyer"]);
    expect(
      dealRiskFlags(
        { ...ok, meddpicc: meddpicc("partial", { economicBuyer: "partial", metrics: "unknown" }) },
        now,
      ),
    ).toEqual(["low-meddpicc"]);
    expect(dealRiskFlags({ ...ok, closeDate: ago(1) }, now)).toEqual(["past-close-date"]);
  });
});
