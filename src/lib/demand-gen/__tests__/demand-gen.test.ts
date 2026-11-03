import { describe, expect, it } from "vitest";
import { MESSAGE_TEMPLATES, renderMessage } from "../messages";
import { kwMatch, playsForSignal, recommendPlays, type PlayLite } from "../recommender";
import { getAiProvider } from "@/lib/ai/provider";

const play = (o: Partial<PlayLite> = {}): PlayLite => ({
  id: "p",
  name: "AI readiness",
  practiceArea: "ai-infra",
  targetPersonas: ["Chief Technology Officer"],
  triggerKeywords: ["GPU", "AI"],
  triggerSignalTypes: ["hiring"],
  ...o,
});

describe("recommender", () => {
  const ctx = {
    practiceStatus: { "ai-infra": "NotEngaged", cloud: "Delivered" },
    initiatives: [{ title: "GPU cluster build-out", practiceAreas: ["ai-infra"], confidence: 0.8 }],
    signals: [
      {
        id: "s1",
        title: "Acme hiring 10 GPU engineers",
        type: "hiring",
        practiceTags: ["ai-infra"],
        relevance: 80,
      },
      {
        id: "s1b",
        title: "Acme hiring 10 GPU engineers",
        type: "hiring",
        practiceTags: ["ai-infra"],
        relevance: 70,
      },
      {
        id: "s2",
        title: "Acme maintains guidance",
        type: "earnings",
        practiceTags: [],
        relevance: 90,
      },
    ],
    personas: [{ title: "Chief Technology Officer", buyingRole: "Technical", engagement: "None" }],
    runningPlayIds: [] as string[],
  };
  it("explains every point and ranks by score", () => {
    const [top] = recommendPlays(
      [
        play(),
        play({ id: "c", name: "FinOps", practiceArea: "cloud", triggerKeywords: ["FinOps"] }),
      ],
      ctx,
    );
    expect(top.play.id).toBe("p");
    const kinds = top.reasons.map((r) => r.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["whitespace", "initiative", "signal", "committee"]),
    );
    expect(top.score).toBe(
      Math.min(
        100,
        top.reasons.reduce((s, r) => s + r.points, 0),
      ),
    );
    // duplicate titles count once; "maintains" must not match "AI"
    expect(top.reasons.filter((r) => r.kind === "signal")).toHaveLength(1);
  });
  it("penalizes plays already running and drops zero scores", () => {
    const recs = recommendPlays([play()], { ...ctx, runningPlayIds: ["p"] });
    expect(recs.length === 0 || recs[0].reasons.some((r) => r.kind === "penalty")).toBe(true);
    expect(
      recommendPlays(
        [play({ practiceArea: "cloud", triggerKeywords: ["zzz"], triggerSignalTypes: [] })],
        {
          ...ctx,
          initiatives: [],
          personas: [{ title: "x", buyingRole: "EconomicBuyer", engagement: "Strong" }],
        },
      ),
    ).toEqual([]);
  });
  it("matches keywords on word boundaries", () => {
    expect(kwMatch("New AI factory", ["AI"])).toBe("AI");
    expect(kwMatch("maintains outlook", ["AI"])).toBeUndefined();
    expect(kwMatch("ServiceNow rollout", ["servicenow"])).toBe("servicenow");
  });
  it("finds plays for a signal", () => {
    const m = playsForSignal(
      [
        play(),
        play({
          id: "x",
          practiceArea: "security",
          triggerKeywords: ["ransomware"],
          triggerSignalTypes: ["incident"],
        }),
      ],
      { title: "Acme GPU expansion", type: "news", practiceTags: ["ai-infra"] },
    );
    expect(m.map((x) => x.play.id)).toEqual(["p"]);
    expect(m[0].why).toBe("mentions “GPU”");
  });
});

describe("message builder", () => {
  const t = MESSAGE_TEMPLATES.find((x) => x.id === "email-evidence")!;
  it("fills variables and reports missing ones visibly", () => {
    const r = renderMessage(t, {
      persona: "CIO",
      account: "Acme",
      practice: "AI Infrastructure",
      industry: "Healthcare",
      evidenceTitle: "Acme is hiring GPU engineers",
      evidenceUrl: "https://jobs.example/1",
      talkTrack1: "Where do AI workloads run today?",
      valueHypothesis: "Readiness de-risks the first cluster.",
    });
    expect(r.subject).toBe("Acme + AI Infrastructure: a quick idea");
    expect(r.body).toContain("I noticed Acme is hiring GPU engineers.");
    expect(r.body).toContain("Source: https://jobs.example/1");
    expect(r.missing.sort()).toEqual(["firstName", "senderName"]);
    expect(r.body).toContain("Hi [firstName],");
  });
  it("omits the source line when evidence has no URL", () => {
    const r = renderMessage(t, { persona: "CIO", account: "Acme", evidenceTitle: "x" });
    expect(r.body).not.toContain("Source:");
    expect(r.missing).not.toContain("evidenceUrl");
  });
  it("keeps LinkedIn connection notes within 300 characters for typical input", () => {
    const li = MESSAGE_TEMPLATES.find((x) => x.id === "linkedin-connect")!;
    const r = renderMessage(li, {
      persona: "CIO",
      account: "Acme",
      firstName: "Sam",
      evidenceTitle: "Acme opens a new data center",
      industry: "Manufacturing",
      practice: "Modern Data Center",
    });
    expect(r.charCount).toBeLessThanOrEqual(300);
  });
});

describe("AI provider", () => {
  it("is disabled by default and refuses to run", async () => {
    const p = getAiProvider();
    expect(p.enabled).toBe(false);
    await expect(p.complete({ task: "draft-message", payload: {} })).rejects.toThrow(
      /off by default/,
    );
  });
});
