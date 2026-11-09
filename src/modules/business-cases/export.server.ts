import "server-only";
import { money, perAccount } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import type { Block } from "@/lib/export/types";
import { computeTco, sensitivity } from "@/lib/tco/compute";
import { CATEGORY_LABELS, lineBase, lineFormula, TcoModelSchema } from "@/lib/tco/model";

const yrs = (n: number) =>
  Array.from({ length: n + 1 }, (_, y) => (y === 0 ? "Upfront" : `Year ${y}`));

/** The account's business case: latest "final" one, else the most recently edited. */
export const builders: SectionBuilders = {
  "business-cases.tco": (ctx) =>
    perAccount(ctx, async (acc) => {
      const c =
        (await ctx.db.businessCase.findFirst({
          where: { accountId: acc.id, status: "final" },
          orderBy: { updatedAt: "desc" },
        })) ??
        (await ctx.db.businessCase.findFirst({
          where: { accountId: acc.id },
          orderBy: { updatedAt: "desc" },
        }));
      if (!c)
        return [
          {
            kind: "paragraph",
            field: "summary",
            text: "No business case for this account yet (TCO & business cases → Create).",
          },
        ];
      const parsed = TcoModelSchema.safeParse(c.model);
      if (!parsed.success)
        return [
          { kind: "paragraph", field: "summary", text: `“${c.name}” has incomplete assumptions.` },
        ];
      const m = parsed.data;
      const r = computeTco(m);
      const cmp = r.comparisons[0];
      const blocks: Block[] = [
        { kind: "heading", level: 3, text: c.name, field: "summary" },
        {
          kind: "kv",
          field: "summary",
          items: [
            ...r.scenarios.map((s) => ({
              label: `${s.name} (${m.years}-yr TCO)`,
              value: money(s.total),
            })),
            ...(cmp
              ? [
                  {
                    label: "Savings vs baseline",
                    value: `${money(cmp.totalSavings)}${cmp.savingsPct !== null ? ` (${Math.round(cmp.savingsPct)}%)` : ""}`,
                  },
                  { label: `NPV of savings @ ${m.discountRatePct}%`, value: money(cmp.npvSavings) },
                  {
                    label: "Payback",
                    value:
                      cmp.paybackYears === null
                        ? "Not within period"
                        : cmp.paybackYears === 0
                          ? "Immediate"
                          : `${cmp.paybackYears.toFixed(1)} years`,
                  },
                  ...(cmp.irr !== null ? [{ label: "IRR", value: `${Math.round(cmp.irr)}%` }] : []),
                ]
              : []),
          ],
        },
        {
          kind: "chart",
          field: "charts",
          title: "Cumulative cost",
          spec: {
            type: "line",
            categories: yrs(m.years),
            series: r.scenarios.map((s) => ({
              name: s.name,
              values: s.cumulative.map(Math.round),
            })),
            valueFormat: "currency",
          },
        },
      ];
      if (cmp)
        blocks.push({
          kind: "paragraph",
          field: "summary",
          text:
            cmp.totalSavings >= 0
              ? `${cmp.name} costs ${money(cmp.totalSavings)} less than ${r.baseline.name} over ${m.years} years${cmp.paybackYears ? `, paying back in ${cmp.paybackYears.toFixed(1)} years` : ""}.`
              : `${cmp.name} costs ${money(-cmp.totalSavings)} more than ${r.baseline.name} over ${m.years} years.`,
        });
      blocks.push({
        kind: "table",
        field: "annual",
        caption: "Annual cost by scenario",
        columns: [
          { key: "s", label: "Scenario" },
          ...yrs(m.years).map((y, i) => ({ key: `y${i}`, label: y, align: "right" as const })),
          { key: "t", label: "Total", align: "right" },
        ],
        rows: r.scenarios.map((s) => ({
          s: { text: s.name },
          ...Object.fromEntries(s.cashflow.map((v, i) => [`y${i}`, { text: money(v) }])),
          t: { text: money(s.total) },
        })),
      });
      const tornado = cmp ? sensitivity(m, cmp.id, 20, 6) : [];
      if (tornado.length)
        blocks.push({
          kind: "chart",
          field: "charts",
          title: "Sensitivity: change in NPV of savings when each assumption moves ±20%",
          spec: {
            type: "hbar",
            categories: tornado.map((d) => d.label),
            series: [
              { name: "−20%", values: tornado.map((d) => Math.round(d.low - d.base)) },
              { name: "+20%", values: tornado.map((d) => Math.round(d.high - d.base)) },
            ],
            valueFormat: "currency",
          },
        });
      blocks.push({
        kind: "table",
        field: "assumptions",
        caption: `Assumptions · ${m.years} years · discount rate ${m.discountRatePct}% · demand growth ${m.growthPct}%/yr`,
        columns: [
          { key: "s", label: "Scenario" },
          { key: "l", label: "Cost" },
          { key: "c", label: "Category" },
          { key: "f", label: "How it's calculated" },
          { key: "v", label: "Year 1 / one-time", align: "right" },
        ],
        rows: m.scenarios.flatMap((s) =>
          s.lines.map((l) => ({
            s: { text: s.name },
            l: { text: l.label },
            c: { text: CATEGORY_LABELS[l.category] },
            f: { text: lineFormula(l) },
            v: { text: money(l.basis === "one-time" ? l.amount : lineBase(l)) },
          })),
        ),
      });
      blocks.push({
        kind: "callout",
        tone: "info",
        field: "summary",
        text: "Estimate based on the assumptions listed. Validate costs with current quotes and the customer's own figures before deciding.",
      });
      if (m.notes) blocks.push({ kind: "paragraph", field: "notes", text: m.notes });
      return blocks;
    }),
};
