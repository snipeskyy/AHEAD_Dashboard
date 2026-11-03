import { describe, expect, it } from "vitest";
import { registry } from "@/modules/registry";
import { ExportConfigSchema, DEFAULT_TEMPLATES } from "../config";
import { documentToMarkdown } from "../markdown";
import { applyRedaction, fieldStates, hiddenFieldSet } from "../redaction";
import type { DocSection, ExportDocument } from "../types";

const defs = registry.exportSections();
const pipelineSection = (): DocSection => ({
  id: "opportunities.pipeline",
  moduleId: "opportunities",
  title: "Pipeline summary",
  blocks: [
    {
      kind: "chart",
      field: "amount",
      title: "Open pipeline by stage",
      spec: {
        type: "hbar",
        categories: ["Qualify"],
        series: [{ name: "Pipeline", values: [100] }],
      },
    },
    {
      kind: "table",
      field: "name",
      columns: [
        { key: "name", label: "Opportunity", field: "name" },
        { key: "amount", label: "Amount", field: "amount" },
        { key: "competitors", label: "Competitors", field: "competitors" },
        { key: "close", label: "Target date", field: "closeDate" },
      ],
      rows: [
        {
          name: { text: "GPU phase 1" },
          amount: { text: "$1.2M" },
          competitors: { text: "Global SI" },
          close: { text: "Mar 1" },
        },
      ],
    },
  ],
});
const committee = (): DocSection => ({
  id: "account-intel.buying-committee",
  moduleId: "account-intel",
  title: "Buying committee",
  internalOnly: true,
  blocks: [{ kind: "paragraph", text: "CIO is the EB", field: "personas" }],
});
const overview = (): DocSection => ({
  id: "account-intel.overview",
  moduleId: "account-intel",
  title: "Account overview",
  blocks: [
    {
      kind: "kv",
      items: [
        { label: "Industry", value: "Insurance", field: "firmographics" },
        { label: "Health score", value: "72", field: "healthScore" },
      ],
    },
  ],
});

describe("redaction", () => {
  it("customer-facing removes internal fields, columns, charts and internal-only sections", () => {
    const r = applyRedaction([pipelineSection(), committee(), overview()], defs, {
      audience: "customer",
      hiddenFields: [],
      mode: "apply",
    });
    expect(r.removedSections).toEqual(["account-intel.buying-committee"]);
    expect(r.sections.map((s) => s.id)).toEqual([
      "opportunities.pipeline",
      "account-intel.overview",
    ]);
    const [pipe, ov] = r.sections;
    expect(pipe.blocks.map((b) => b.kind)).toEqual(["table"]); // chart (amount) gone
    const table = pipe.blocks[0];
    if (table.kind !== "table") throw new Error();
    expect(table.columns.map((c) => c.key)).toEqual(["name", "close"]);
    expect(Object.keys(table.rows[0])).toEqual(["name", "close"]);
    expect(JSON.stringify(r.sections)).not.toMatch(/\$1\.2M|Global SI|Health score|CIO is the EB/);
    if (ov.blocks[0].kind !== "kv") throw new Error();
    expect(ov.blocks[0].items.map((i) => i.label)).toEqual(["Industry"]);
    expect(r.removedFields).toEqual(
      expect.arrayContaining([
        "opportunities.pipeline.amount",
        "opportunities.pipeline.competitors",
        "account-intel.overview.healthScore",
      ]),
    );
  });

  it("internal audience keeps everything unless a field is explicitly hidden", () => {
    const all = applyRedaction([pipelineSection(), committee()], defs, {
      audience: "internal",
      hiddenFields: [],
      mode: "apply",
    });
    expect(all.removedFields).toEqual([]);
    expect(all.sections).toHaveLength(2);
    const one = applyRedaction([pipelineSection()], defs, {
      audience: "internal",
      hiddenFields: ["opportunities.pipeline.closeDate"],
      mode: "apply",
    });
    const t = one.sections[0].blocks[1];
    if (t.kind !== "table") throw new Error();
    expect(t.columns.map((c) => c.key)).toEqual(["name", "amount", "competitors"]);
  });

  it("preview mode marks instead of removing", () => {
    const r = applyRedaction([pipelineSection(), committee()], defs, {
      audience: "customer",
      hiddenFields: [],
      mode: "preview",
    });
    expect(r.sections).toHaveLength(2);
    expect(r.sections[1].redacted).toBe(true);
    expect(r.sections[0].blocks[0].redacted).toBe(true);
    const t = r.sections[0].blocks[1];
    if (t.kind !== "table") throw new Error();
    expect(t.columns.filter((c) => c.redacted).map((c) => c.key)).toEqual([
      "amount",
      "competitors",
    ]);
  });

  it("drops sections that end up empty and locks internal fields for customers", () => {
    const r = applyRedaction(
      [
        {
          id: "command-home.kpis",
          moduleId: "command-home",
          title: "KPIs",
          blocks: [{ kind: "kv", field: "pipelineTotal", items: [] }],
        },
      ],
      defs,
      { audience: "customer", hiddenFields: [], mode: "apply" },
    );
    expect(r.sections).toEqual([]);
    const def = defs.find((d) => d.id === "opportunities.pipeline")!;
    const states = fieldStates(def, { audience: "customer", hiddenFields: [] });
    expect(states.find((f) => f.id === "amount")).toMatchObject({ locked: true, visible: false });
    expect(states.find((f) => f.id === "closeDate")).toMatchObject({
      locked: false,
      visible: true,
    });
    expect(
      hiddenFieldSet(defs, { audience: "customer", hiddenFields: [] }).has(
        "signals.key-signals.relevance",
      ),
    ).toBe(true);
  });
});

describe("templates and markdown", () => {
  it("default templates only reference registered sections", () => {
    const ids = new Set(defs.map((d) => d.id));
    for (const t of DEFAULT_TEMPLATES)
      for (const s of t.config.sections) expect(ids.has(s), s).toBe(true);
    expect(
      ExportConfigSchema.safeParse({
        title: "x",
        scope: { type: "portfolio" },
        sections: ["exports.cover"],
        audience: "customer",
      }).success,
    ).toBe(true);
  });
  it("renders markdown with tables, links, charts-as-tables and demo notice", () => {
    const doc: ExportDocument = {
      title: "QBR",
      subtitle: "Executive summary",
      scopeLabel: "Acme",
      audience: "internal",
      generatedAt: "2026-11-03T00:00:00.000Z",
      version: 2,
      watermark: "INTERNAL ONLY",
      dateStamp: true,
      preparedBy: "",
      isDemo: true,
      redaction: { removedFields: [], removedSections: [], mode: "apply" },
      sections: [
        {
          id: "s",
          moduleId: "m",
          title: "Signals",
          blocks: [
            {
              kind: "table",
              columns: [{ key: "t", label: "Signal" }],
              rows: [{ t: { text: "A | B", href: "https://x.example" } }],
            },
            {
              kind: "chart",
              title: "Pipe",
              spec: { type: "bar", categories: ["Q1"], series: [{ name: "Won", values: [5] }] },
            },
          ],
        },
      ],
    };
    const md = documentToMarkdown(doc);
    expect(md).toContain("# QBR");
    expect(md).toContain("Acme · 2026-11-03 · v2");
    expect(md).toContain("> **INTERNAL ONLY**");
    expect(md).toContain("DEMO DATA");
    expect(md).toContain("| [A \\| B](https://x.example) |");
    expect(md).toContain("| Q1 | 5 |");
  });
});
