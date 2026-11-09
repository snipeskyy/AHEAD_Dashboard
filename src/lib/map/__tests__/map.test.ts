import { describe, expect, it } from "vitest";
import {
  customerSteps,
  mapProgress,
  MapStepsSchema,
  sortSteps,
  starterSteps,
  type MapStep,
} from "../model";

const now = new Date("2026-11-09T12:00:00Z");
let n = 0;
const id = () => `s${++n}`;
const step = (p: Partial<MapStep>): MapStep =>
  MapStepsSchema.parse([{ id: id(), title: "Step", ...p }])[0];

describe("mutual action plan model", () => {
  it("starter steps count back from the target date and contain no account data", () => {
    const s = starterSteps("2027-03-31", now, id);
    expect(s).toHaveLength(9);
    expect(s.at(-2)).toMatchObject({ title: "Executive sign-off", dueDate: "2027-03-28" });
    expect(s.at(-1)?.dueDate).toBe("2027-04-07");
    expect(s.every((x) => x.status === "planned" && x.note === "")).toBe(true);
  });

  it("sorts by date with undated steps last", () => {
    const s = sortSteps([
      step({ title: "cc" }),
      step({ title: "bb", dueDate: "2026-12-02" }),
      step({ title: "aa", dueDate: "2026-12-01" }),
    ]);
    expect(s.map((x) => x.title)).toEqual(["aa", "bb", "cc"]);
  });

  it("progress: overdue, at risk, slipping past target, health and a computed summary", () => {
    const steps = [
      step({ title: "Done", dueDate: "2026-10-01", status: "done" }),
      step({ title: "Late", dueDate: "2026-11-01" }),
      step({ title: "Risky", dueDate: "2026-12-01", status: "at-risk" }),
      step({ title: "Kickoff", dueDate: "2027-02-01" }),
    ];
    const p = mapProgress(steps, "2027-01-15", now);
    expect(p).toMatchObject({
      total: 4,
      done: 1,
      overdue: 1,
      atRisk: 1,
      slipsPastTarget: false,
      health: "off-track",
      daysToTarget: 67,
    });
    expect(p.next?.title).toBe("Late");
    expect(p.summary).toBe("1 of 4 steps done, 1 overdue, 1 at risk, 67 days to the target date.");
    expect(mapProgress([step({ dueDate: "2027-02-01" })], "2027-01-15", now).health).toBe(
      "off-track",
    );
    expect(mapProgress([step({ dueDate: "2026-12-01" })], null, now).health).toBe("on-track");
    expect(mapProgress([], null, now).health).toBe("empty");
  });

  it("customer view drops hidden steps and internal notes", () => {
    const c = customerSteps([
      step({ title: "Shown", note: "internal" }),
      step({ title: "Hidden", customerVisible: false }),
    ]);
    expect(c.map((x) => x.title)).toEqual(["Shown"]);
    expect(c[0]).not.toHaveProperty("note");
  });
});
