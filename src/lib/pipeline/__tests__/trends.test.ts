import { describe, expect, it } from "vitest";
import {
  closeReasons,
  cohortConversion,
  lastQuarters,
  winLossByPractice,
  winLossByQuarter,
  winRateTakeaway,
} from "../trends";
import type { PipelineOpp } from "../types";

const now = new Date("2026-11-09T12:00:00Z");
const d = (s: string) => new Date(`${s}T12:00:00Z`);
const opp = (p: Partial<PipelineOpp>): PipelineOpp => ({
  stage: "Qualify",
  amount: 100,
  probability: 10,
  forecastCategory: "Pipeline",
  closeDate: d("2026-12-31"),
  createdAt: d("2026-01-10"),
  closedAt: null,
  stageChangedAt: d("2026-01-10"),
  practiceArea: "modern-dc",
  ...p,
});

describe("pipeline trends", () => {
  it("lists the last n quarters ending with the current one", () => {
    expect(lastQuarters(now, 3)).toEqual(["2026-Q2", "2026-Q3", "2026-Q4"]);
  });

  it("counts wins/losses per closing quarter with win rate and won-deal cycle time", () => {
    const rows = winLossByQuarter(
      [
        opp({
          stage: "ClosedWon",
          createdAt: d("2026-07-01"),
          closedAt: d("2026-07-31"),
          amount: 500,
        }),
        opp({
          stage: "ClosedWon",
          createdAt: d("2026-06-01"),
          closedAt: d("2026-08-30"),
          amount: 300,
        }),
        opp({ stage: "ClosedLost", closedAt: d("2026-09-01"), amount: 200 }),
        opp({ stage: "Proposal" }),
      ],
      now,
      2,
    );
    expect(rows[0]).toMatchObject({
      quarter: "2026-Q3",
      won: 2,
      lost: 1,
      wonAmount: 800,
      lostAmount: 200,
    });
    expect(rows[0].winRate).toBeCloseTo(2 / 3);
    expect(rows[0].avgCycleDays).toBeCloseTo((30 + 90) / 2);
    expect(rows[1]).toMatchObject({
      quarter: "2026-Q4",
      won: 0,
      lost: 0,
      winRate: null,
      avgCycleDays: null,
    });
  });

  it("splits win rate by practice and omits practices without closed deals", () => {
    const r = winLossByPractice(
      [
        opp({ stage: "ClosedWon", closedAt: d("2026-10-01") }),
        opp({ stage: "ClosedLost", practiceArea: "ai", closedAt: d("2026-10-02") }),
      ],
      ["modern-dc", "ai", "security"],
      now,
    );
    expect(r.map((x) => [x.practice, x.winRate])).toEqual([
      ["modern-dc", 1],
      ["ai", 0],
    ]);
  });

  it("cohort conversion uses stage history, so a lost deal that reached Proposal still counts", () => {
    const c = cohortConversion(
      [
        opp({
          id: "a",
          stage: "ClosedLost",
          createdAt: d("2026-10-02"),
          closedAt: d("2026-11-01"),
        }),
        opp({ id: "b", stage: "Solution", createdAt: d("2026-10-05") }),
        opp({ id: "c", stage: "ClosedWon", createdAt: d("2026-10-06"), closedAt: d("2026-11-02") }),
      ],
      [
        {
          opportunityId: "a",
          fromStage: "Solution",
          toStage: "Proposal",
          changedAt: d("2026-10-20"),
        },
      ],
      now,
      1,
    )[0];
    expect(c).toMatchObject({
      quarter: "2026-Q4",
      created: 3,
      stillOpen: 1,
      reached: { Solution: 3, Proposal: 2, ClosedWon: 1 },
    });
  });

  it("counts recorded close reasons and unrecorded ones separately", () => {
    const r = closeReasons(
      [
        opp({ stage: "ClosedLost", closeReason: "competitor", closedAt: d("2026-10-01") }),
        opp({ stage: "ClosedWon", closedAt: d("2026-10-01") }),
      ],
      now,
    );
    expect(r.rows).toEqual([{ reason: "competitor", won: 0, lost: 1 }]);
    expect(r.unrecorded).toBe(1);
  });

  it("takeaway compares halves and stays silent with too few deals", () => {
    const q = (won: number, lost: number) => ({
      quarter: "x",
      won,
      lost,
      wonAmount: 0,
      lostAmount: 0,
      winRate: null,
      avgCycleDays: null,
    });
    expect(winRateTakeaway([q(1, 3), q(0, 0), q(3, 1), q(0, 0)])).toBe(
      "Win rate rose to 75% over the last 2 quarters, from 25% in the 2 before (3 won, 1 lost).",
    );
    expect(winRateTakeaway([q(1, 0), q(1, 0)])).toBeNull();
  });
});
