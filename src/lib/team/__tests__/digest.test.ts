import { describe, expect, it } from "vitest";
import { buildDigest, type DigestInput } from "../digest";

const base: DigestInput = {
  teamName: "Fictional team",
  weekStart: new Date("2026-11-02T12:00:00Z"),
  now: new Date("2026-11-09T12:00:00Z"),
  showAmounts: true,
  stageMoves: [
    {
      opp: "Refresh",
      account: "Example Co",
      from: "Negotiate",
      to: "ClosedWon",
      amount: 450000,
      at: new Date("2026-11-05"),
    },
    {
      opp: "Pilot",
      account: "Sample Inc",
      from: "Discover",
      to: "Solution",
      amount: 50000,
      at: new Date("2026-11-06"),
    },
  ],
  created: [],
  closingSoon: [
    {
      opp: "Pilot",
      account: "Sample Inc",
      amount: 50000,
      closeDate: new Date("2026-11-20T12:00:00Z"),
    },
  ],
  tasksDone: [{ title: "Send agenda", assignee: "Me" }],
  tasksOverdue: [
    {
      title: "Book workshop",
      assignee: "Riley",
      dueDate: new Date("2026-11-03T12:00:00Z"),
      account: "Example Co",
    },
  ],
  planSteps: [
    { plan: "Refresh plan", step: "Security review", dueDate: "2026-11-12", overdue: false },
  ],
  topSignals: [],
};

describe("weekly team digest", () => {
  it("builds sections and markdown from records only", () => {
    const d = buildDigest(base);
    expect(d.title).toBe("Fictional team weekly digest: Nov 2 to Nov 9");
    expect(d.summary).toBe("1 won · 0 lost · 1 moved · 0 new · 1 overdue task");
    const s = Object.fromEntries(d.sections.map((x) => [x.id, x.items]));
    expect(s.wins).toEqual(["Won: Refresh · Example Co ($450.0K)"]);
    expect(s.moves).toEqual(["Pilot · Sample Inc: Discover → Solution"]);
    expect(s.tasks).toEqual([
      "1 task completed this week",
      "Riley: 1 overdue",
      "Overdue since Nov 3: Book workshop · Example Co (Riley)",
    ]);
    expect(s.plans).toEqual(["Nov 12: Security review (Refresh plan)"]);
    expect(d.markdown).toContain("## New pipeline\n\n_No new opportunities this week._");
  });

  it("leaves amounts out when the role hides them", () => {
    const d = buildDigest({ ...base, showAmounts: false });
    expect(d.markdown).not.toMatch(/\$/);
  });
});
