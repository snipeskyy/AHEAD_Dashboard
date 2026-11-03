import { describe, expect, it } from "vitest";
import {
  computeForecast,
  computeKpis,
  nextPeriods,
  pipelineAging,
  quarterBounds,
  quarterKey,
  stageConversion,
  stageVelocity,
} from "../analytics";
import type { PipelineOpp, StageEvent } from "../types";

const now = new Date("2026-11-15T12:00:00Z");
const d = (s: string) => new Date(`${s}T12:00:00Z`);
const opp = (o: Partial<PipelineOpp>): PipelineOpp => ({
  stage: "Proposal",
  amount: 100_000,
  probability: 50,
  forecastCategory: "Pipeline",
  closeDate: d("2026-12-01"),
  createdAt: d("2026-09-01"),
  closedAt: null,
  stageChangedAt: d("2026-11-01"),
  practiceArea: "cloud",
  ...o,
});

describe("quarters", () => {
  it("computes keys and bounds", () => {
    expect(quarterKey(now)).toBe("2026-Q4");
    const { start, end } = quarterBounds(now);
    expect(start.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(nextPeriods(now, "quarter", 3, -1)).toEqual(["2026-Q3", "2026-Q4", "2027-Q1"]);
    expect(nextPeriods(now, "month", 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("computeKpis", () => {
  const opps = [
    opp({ amount: 200_000, probability: 50 }),
    opp({ amount: 100_000, probability: 20, closeDate: d("2027-02-01") }),
    opp({
      stage: "ClosedWon",
      amount: 50_000,
      closedAt: d("2026-10-10"),
      createdAt: d("2026-08-11"),
    }),
    opp({ stage: "ClosedLost", amount: 75_000, closedAt: d("2026-06-01") }),
    opp({
      stage: "ClosedWon",
      amount: 999_999,
      closedAt: d("2024-01-01"),
      createdAt: d("2023-01-01"),
    }), // outside 12m
  ];
  const k = computeKpis(opps, now, 1_000_000, 3);
  it("sums open pipeline and weighted", () => {
    expect(k.pipelineTotal).toBe(300_000);
    expect(k.weightedPipeline).toBe(120_000);
    expect(k.activeOpps).toBe(2);
  });
  it("computes win rate and cycle over the last 12 months", () => {
    expect(k.winRate).toBe(0.5);
    expect(k.avgCycleDays).toBe(60);
  });
  it("computes coverage against remaining quarterly target", () => {
    expect(k.wonThisQuarter).toBe(50_000);
    expect(k.pipelineThisQuarter).toBe(200_000);
    expect(k.coverageRatio).toBeCloseTo(200_000 / 950_000, 5);
  });
  it("reports null coverage when the target is already met", () => {
    expect(computeKpis(opps, now, 10_000, 3).coverageRatio).toBeNull();
  });
});

describe("computeForecast", () => {
  it("buckets commit ⊂ best case ⊂ pipeline and closed won, skipping omitted", () => {
    const f = computeForecast(
      [
        opp({ forecastCategory: "Commit", amount: 10, closeDate: d("2026-11-20") }),
        opp({ forecastCategory: "BestCase", amount: 20, closeDate: d("2026-11-25") }),
        opp({ forecastCategory: "Pipeline", amount: 40, closeDate: d("2026-11-26") }),
        opp({ forecastCategory: "Omitted", amount: 1000, closeDate: d("2026-11-26") }),
        opp({
          stage: "ClosedWon",
          amount: 5,
          closedAt: d("2026-11-02"),
          forecastCategory: "Closed",
        }),
        opp({ forecastCategory: "Commit", amount: 7, closeDate: d("2027-05-01") }), // outside periods
      ],
      "month",
      ["2026-11", "2026-12"],
    );
    expect(f[0]).toMatchObject({
      commit: 10,
      bestCase: 30,
      pipeline: 70,
      closedWon: 5,
      weighted: 35,
    });
    expect(f[1]).toMatchObject({ commit: 0, pipeline: 0 });
  });
});

describe("stage analytics", () => {
  const ev = (id: string, to: string, at: string): StageEvent => ({
    opportunityId: id,
    fromStage: null,
    toStage: to,
    changedAt: d(at),
  });
  const events = [
    ev("a", "Qualify", "2026-01-01"),
    ev("a", "Discover", "2026-01-11"),
    ev("a", "Solution", "2026-01-31"),
    ev("b", "Qualify", "2026-01-01"),
    ev("b", "ClosedLost", "2026-01-21"),
    ev("c", "Qualify", "2026-02-01"),
    ev("c", "Discover", "2026-02-05"),
    ev("c", "Solution", "2026-02-10"),
    ev("c", "Proposal", "2026-02-12"),
    ev("c", "Negotiate", "2026-02-13"),
    ev("c", "ClosedWon", "2026-02-20"),
  ];
  it("conversion counts deals that advanced beyond each stage", () => {
    const c = stageConversion(events);
    expect(c[0]).toMatchObject({ stage: "Qualify", reached: 3, advanced: 2 });
    expect(c[1]).toMatchObject({ stage: "Discover", reached: 2, advanced: 2 });
    expect(c[4]).toMatchObject({ stage: "Negotiate", reached: 1, advanced: 1, rate: 1 });
  });
  it("velocity averages days in each stage", () => {
    const v = stageVelocity(events, d("2026-03-01"));
    expect(v[0].avgDays).toBeCloseTo((10 + 20 + 4) / 3, 5); // a: 10, b: 20 (to lost), c: 4
    expect(v[1].avgDays).toBeCloseTo((20 + 5) / 2, 5);
  });
  it("aging buckets open amount by age", () => {
    const rows = pipelineAging(
      [
        opp({ stage: "Qualify", createdAt: d("2026-11-01"), amount: 5 }),
        opp({ stage: "Qualify", createdAt: d("2026-01-01"), amount: 7 }),
      ],
      now,
    );
    expect(rows[0].buckets).toEqual([5, 0, 0, 7]);
  });
});
