import { describe, expect, it } from "vitest";
import { DEFAULT_TAGGING_RULES, tagText } from "../rules";

describe("tagText", () => {
  it("maps spec examples to practice areas", () => {
    expect(tagText("Company builds an AI factory with GPU clusters").tags).toEqual(["ai-infra"]);
    expect(tagText("Plans data center consolidation and liquid cooling").tags).toContain(
      "modern-dc",
    );
    expect(tagText("Hit by ransomware; adopting zero trust").tags).toEqual(["security"]);
    expect(tagText("Expanding ServiceNow ITSM").tags).toEqual(["esm"]);
    expect(tagText("FinOps team to cut cloud spend").tags).toEqual(["cloud"]);
  });

  it("is case-insensitive and matches whole words only", () => {
    expect(tagText("gpu capacity").tags).toEqual(["ai-infra"]);
    expect(tagText("GPUs in demand").tags).toEqual(["ai-infra"]); // plural
    expect(tagText("The SOCIAL media team").tags).toEqual([]); // "SOC" must not match inside "SOCIAL"
    expect(tagText("Sustainability report published").tags).toEqual([]);
  });

  it("reports every keyword hit for transparency", () => {
    const r = tagText("GPU inference platform with Kubernetes");
    expect(r.hits).toEqual(
      expect.arrayContaining([
        { practiceArea: "ai-infra", keyword: "GPU" },
        { practiceArea: "ai-infra", keyword: "inference" },
        { practiceArea: "automation", keyword: "Kubernetes" },
      ]),
    );
    expect(r.tags).toEqual(["ai-infra", "automation"]);
  });

  it("uses user-supplied rules and escapes regex characters", () => {
    const rules = [{ practiceArea: "x", keywords: ["C++", "CI/CD"] }];
    expect(tagText("We use C++ and CI/CD", rules).hits).toHaveLength(2);
    expect(tagText("CICD", rules).hits).toHaveLength(0);
  });

  it("default rules cover every default practice area", () => {
    expect(new Set(DEFAULT_TAGGING_RULES.map((r) => r.practiceArea)).size).toBe(9);
  });
});
