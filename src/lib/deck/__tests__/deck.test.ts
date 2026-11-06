import { describe, expect, it } from "vitest";
import type { Block, ExportDocument } from "@/lib/export/types";
import { chartTakeaway, fmtValue } from "../narrative";
import { planSlides } from "../plan";
import { brandTheme, NEUTRAL_THEME, tint } from "../theme";
import { DEFAULT_DECK_OPTIONS } from "../types";

const doc = (sections: Array<{ id: string; title: string; blocks: Block[] }>): ExportDocument => ({
  title: "Example Co — QBR",
  subtitle: "Executive summary",
  scopeLabel: "Example Co",
  audience: "internal",
  generatedAt: "2026-11-06T12:00:00Z",
  version: 1,
  watermark: "",
  dateStamp: true,
  preparedBy: "Alex",
  isDemo: false,
  sections: sections.map((s) => ({ ...s, moduleId: "m" })),
  redaction: { removedFields: [], removedSections: [], mode: "apply" },
});

const bar: Block = { kind: "chart", title: "Pipeline by practice", spec: { type: "bar", categories: ["Cloud", "AI", "Security"], series: [{ name: "Open", values: [200_000, 600_000, 200_000] }], valueFormat: "currency" } };

describe("narrative", () => {
  it("states the leader and its share, only from the chart's numbers", () => {
    expect(chartTakeaway((bar as Extract<Block, { kind: "chart" }>).spec)).toBe("AI leads with $600K (60% of $1.0M total).");
  });
  it("describes a trend and a target honestly", () => {
    expect(chartTakeaway({ type: "line", categories: ["Q1", "Q2", "Q3"], series: [{ name: "Pipeline", values: [100, 120, 150] }] })).toBe("Pipeline rose 50% from Q1 to Q3 (100 → 150).");
    expect(chartTakeaway({ type: "bar", categories: ["Q1", "Q2"], series: [{ name: "Won", values: [5, 12] }], reference: { label: "Target", value: 10 } })).toBe("1 of 2 periods are at or above target (10).");
    expect(chartTakeaway({ type: "bar", categories: ["A"], series: [{ name: "x", values: [0] }] })).toBeNull();
  });
  it("formats values", () => {
    expect(fmtValue(1_250_000, "currency")).toBe("$1.3M");
    expect(fmtValue(42.4, "percent")).toBe("42%");
  });
});

describe("slide planner", () => {
  const sections = [
    { id: "exports.cover", title: "Cover", blocks: [{ kind: "paragraph", text: "cover" } as Block] },
    { id: "a.kpis", title: "Snapshot", blocks: [{ kind: "kv", items: [{ label: "Pipeline", value: "$1.0M" }, { label: "Win rate", value: "34%" }] } as Block] },
    { id: "a.pipe", title: "Pipeline", blocks: [bar, { kind: "paragraph", text: "AI is the growth engine." } as Block] },
    { id: "a.table", title: "Deals", blocks: [{ kind: "table", columns: [{ key: "n", label: "Name" }], rows: Array.from({ length: 19 }, (_, i) => ({ n: { text: `Deal ${i}` } })) } as Block] },
    { id: "a.list", title: "Risks", blocks: [{ kind: "heading", text: "Top risks", level: 3 } as Block, { kind: "list", items: Array.from({ length: 9 }, (_, i) => ({ text: `Risk ${i}` })) } as Block, { kind: "callout", text: "Decide by Friday" } as Block] },
  ];

  it("picks a layout per block and paginates", () => {
    const s = planSlides(doc(sections), DEFAULT_DECK_OPTIONS);
    expect(s.map((x) => `${x.id}=${x.layout}`)).toEqual([
      "title=title",
      "agenda=agenda",
      "a.kpis:1=kpis",
      "a.pipe:1=chart-takeaway",
      "a.table:1=table",
      "a.table:2=table",
      "a.table:3=table",
      "a.list:1=two-column",
      "a.list:2=quote",
      "closing=closing",
    ]);
    expect(s[3].takeaway).toBe("AI is the growth engine."); // the section's own sentence wins over the computed one
    expect(s[3].notes).toContain("AI leads with $600K");
    expect(s[4].subtitle).toBe("1 of 3");
    expect(s[7]).toMatchObject({ title: "Top risks", kicker: "Risks" });
    expect(s[0].kicker).toContain("Prepared by Alex");
  });

  it("honors hidden slides, note overrides, dividers and no agenda", () => {
    const opts = { ...DEFAULT_DECK_OPTIONS, agenda: false, dividers: true, hiddenSlides: ["a.table:2"], notes: { "a.kpis:1": "Lead with the win rate." } };
    const s = planSlides(doc(sections), opts);
    expect(s.find((x) => x.id === "agenda")).toBeUndefined();
    expect(s.find((x) => x.id === "a.table:2")).toBeUndefined();
    expect(s.find((x) => x.id === "a.kpis:divider")?.layout).toBe("divider");
    expect(s.find((x) => x.id === "a.kpis:1")?.notes).toBe("Lead with the win rate.");
    const builder = planSlides(doc(sections), opts, { keepHidden: true });
    expect(builder.find((x) => x.id === "a.table:2")?.hidden).toBe(true);
  });

  it("uses a next-steps section for the closing slide", () => {
    const s = planSlides(doc([...sections, { id: "exports.next-steps", title: "Next steps", blocks: [{ kind: "list", items: [{ text: "Workshop on 11/20" }] }] }]), DEFAULT_DECK_OPTIONS);
    expect(s.at(-1)).toMatchObject({ layout: "closing", title: "Next steps" });
    expect(s.at(-1)!.blocks).toHaveLength(1);
  });
});

describe("theme", () => {
  it("brand theme changes the accent only; chart series stay validated", () => {
    const t = brandTheme({ primary: "#1d4ed8" });
    expect(t.primary).toBe("1D4ED8");
    expect(t.series).toEqual(NEUTRAL_THEME.series);
    expect(tint("000000", 0.5)).toBe("808080");
  });
});
