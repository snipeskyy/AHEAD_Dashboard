import { describe, expect, it } from "vitest";
import { registry } from "@/modules/registry";
import { DEFAULT_LAYOUTS, LayoutWidgetsSchema } from "../layouts";
import { topMovers } from "../movers";
import { diversify, nextBestActions } from "../next-actions";

const now = new Date("2026-11-15T12:00:00Z");
const DAY = 86_400_000;

describe("default layouts", () => {
  it("ships three valid layouts that only reference registered widgets", () => {
    expect(DEFAULT_LAYOUTS.map((l) => l.name)).toEqual([
      "Monday Pipeline Review",
      "Account Prep",
      "Exec Readout",
    ]);
    for (const l of DEFAULT_LAYOUTS) {
      expect(LayoutWidgetsSchema.safeParse(l.widgets).success).toBe(true);
      for (const w of l.widgets) {
        expect(registry.widget(w.widgetId), w.widgetId).toBeTruthy();
        expect(w.x + w.w).toBeLessThanOrEqual(12);
      }
      expect(new Set(l.widgets.map((w) => w.i)).size).toBe(l.widgets.length);
    }
  });
});

describe("next best actions", () => {
  const baseOpp = {
    id: "o1",
    name: "Deal",
    accountId: "a1",
    accountName: "Acme",
    accountTier: "Strategic",
    stage: "Proposal",
    amount: 500_000,
    closeDate: new Date(now.getTime() + 60 * DAY),
    daysInStage: 5,
    meddpiccScore: 80,
    riskFlags: [] as string[],
  };
  it("explains each action and ranks by priority", () => {
    const out = nextBestActions({
      now,
      opps: [
        { ...baseOpp, riskFlags: ["no-economic-buyer"] },
        { ...baseOpp, id: "o2", closeDate: new Date(now.getTime() + 10 * DAY), meddpiccScore: 40 },
        { ...baseOpp, id: "o3", accountTier: "Maintain", riskFlags: ["stalled"] }, // Maintain stalled deals are skipped
      ],
      accounts: [
        {
          id: "a1",
          name: "Acme",
          tier: "Growth",
          lastTouchAt: new Date(now.getTime() - 20 * DAY),
          nextTouchAt: null,
          highSignals7d: 3,
        },
        {
          id: "a2",
          name: "Cold Co",
          tier: "Strategic",
          lastTouchAt: null,
          nextTouchAt: null,
          highSignals7d: 0,
        },
      ],
      overduePlanActions: [
        {
          id: "p1",
          accountId: "a1",
          accountName: "Acme",
          text: "Book briefing",
          dueDate: new Date(now.getTime() - 3 * DAY),
        },
      ],
    });
    expect(out.map((a) => a.id)).toEqual(
      expect.arrayContaining(["eb-o1", "close-o2", "sig-a1", "cold-a2", "plan-p1"]),
    );
    expect(out.find((a) => a.id === "stall-o3")).toBeUndefined();
    expect(out.find((a) => a.id === "close-o2")!.why).toBe(
      "Closes in 10 days with MEDDPICC at 40%",
    );
    for (const a of out) expect(a.why.length).toBeGreaterThan(5);
  });
  it("diversify round-robins across action types", () => {
    const mk = (id: string, priority: number) => ({
      id,
      priority,
      kind: "deal" as const,
      title: id,
      why: "x",
      href: "/",
    });
    expect(
      diversify([mk("eb-1", 9), mk("eb-2", 8), mk("eb-3", 7), mk("plan-1", 1)], 3).map((a) => a.id),
    ).toEqual(["eb-1", "plan-1", "eb-2"]);
  });
});

describe("top movers", () => {
  it("scores change and explains it", () => {
    const m = topMovers([
      {
        accountId: "a",
        accountName: "A",
        tier: "Growth",
        advances: 2,
        setbacks: 0,
        wonAmount: 0,
        newPipeline: 0,
        highSignals: 1,
      },
      {
        accountId: "b",
        accountName: "B",
        tier: "Growth",
        advances: 0,
        setbacks: 3,
        wonAmount: 0,
        newPipeline: 0,
        highSignals: 0,
      },
      {
        accountId: "c",
        accountName: "C",
        tier: "Growth",
        advances: 0,
        setbacks: 0,
        wonAmount: 0,
        newPipeline: 0,
        highSignals: 0,
      },
    ]);
    expect(m.map((x) => [x.accountId, x.direction])).toEqual([
      ["b", "down"],
      ["a", "up"],
    ]);
    expect(m[1].reasons).toEqual(["2 stage advances", "1 high-relevance signal"]);
  });
});
