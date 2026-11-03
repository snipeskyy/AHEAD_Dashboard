import { describe, expect, it } from "vitest";
import { deriveOpeningAngles, derivePainPoints } from "../angles";
import { buildOrgTree, committeeGaps } from "../committee";
import { intelPolicyViolation } from "../policy";

describe("intel policy (never invent facts about real companies)", () => {
  it("allows anything on demo accounts", () => {
    expect(intelPolicyViolation({ isDemo: true }, { source: "seed" })).toBeNull();
  });
  it("requires a public URL or user-hypothesis on real accounts", () => {
    expect(intelPolicyViolation({ isDemo: false }, { source: "user-hypothesis" })).toBeNull();
    expect(
      intelPolicyViolation(
        { isDemo: false },
        { source: "news", sourceUrl: "https://example.com/a" },
      ),
    ).toBeNull();
    expect(intelPolicyViolation({ isDemo: false }, { source: "news", sourceUrl: null })).toMatch(
      /public source/,
    );
    expect(
      intelPolicyViolation({ isDemo: false }, { source: "seed", sourceUrl: "https://x.y" }),
    ).toMatch(/Seed/);
  });
});

describe("pain points & opening angles are evidence-derived", () => {
  const empty = { initiatives: [], signals: [], practiceStatus: {} };
  it("produce nothing without evidence", () => {
    expect(derivePainPoints(empty)).toEqual([]);
    expect(deriveOpeningAngles(empty)).toEqual([]);
  });
  it("tie every angle to one piece of evidence and prefer un-engaged practices", () => {
    const angles = deriveOpeningAngles({
      initiatives: [
        {
          id: "i1",
          title: "Cloud cost program",
          practiceAreas: ["cloud"],
          source: "user-hypothesis",
          sourceUrl: null,
          confidence: 0.5,
        },
      ],
      signals: [
        {
          id: "s1",
          title: "Hiring GPU engineers",
          type: "hiring",
          practiceTags: ["ai-infra"],
          url: "https://jobs.example/1",
          source: "greenhouse",
          publishedAt: "2026-01-01",
          relevance: 50,
        },
        {
          id: "s2",
          title: "Security incident",
          type: "incident",
          practiceTags: ["security"],
          url: null,
          source: "rss-news",
          publishedAt: "2026-01-02",
          relevance: 90,
        },
      ],
      practiceStatus: { "ai-infra": "NotEngaged", security: "Delivered" },
    });
    expect(angles.map((a) => a.practiceArea)).toEqual(["ai-infra", "security", "cloud"]);
    for (const a of angles) expect(a.evidence.id).toBeTruthy();
    expect(angles[0].evidence.url).toBe("https://jobs.example/1");
  });
});

describe("buying committee", () => {
  const p = (
    id: string,
    role: string,
    seniority = "VP",
    engagement = "Light",
    reportsToId: string | null = null,
  ) => ({ id, title: id, seniority, buyingRole: role, engagement, reportsToId });
  it("flags missing Economic Buyer and Champion as critical", () => {
    const gaps = committeeGaps([p("a", "Technical"), p("b", "Influencer", "C-Level")]);
    expect(gaps.slice(0, 2).map((g) => g.message)).toEqual([
      "No Economic Buyer identified",
      "No Champion identified",
    ]);
    expect(gaps[0].severity).toBe("critical");
  });
  it("flags identified-but-unengaged roles and missing C-level", () => {
    const gaps = committeeGaps([
      p("a", "EconomicBuyer", "VP", "None"),
      p("b", "Champion"),
      p("c", "Technical"),
      p("d", "Influencer"),
    ]);
    expect(gaps.map((g) => g.message)).toEqual([
      "Economic Buyer identified but not engaged",
      "No C-level relationship mapped",
    ]);
  });
  it("builds an org tree and survives cycles / dangling references", () => {
    const tree = buildOrgTree([
      p("ceo", "EconomicBuyer", "C-Level"),
      p("vp", "Champion", "VP", "Light", "ceo"),
      p("x", "Technical", "Director", "Light", "y"),
      p("y", "Technical", "Director", "Light", "x"),
      p("z", "Influencer", "Manager", "Light", "ghost"),
    ]);
    const count = (ns: typeof tree): number => ns.reduce((s, n) => s + 1 + count(n.children), 0);
    expect(count(tree)).toBe(5);
    expect(tree.find((n) => n.persona.id === "ceo")!.children.map((c) => c.persona.id)).toEqual([
      "vp",
    ]);
    expect(tree.some((n) => n.persona.id === "z")).toBe(true);
  });
});
