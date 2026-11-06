"use client";
import { Chart, barStyle, baseOption, categoryAxis, valueAxis } from "@/components/chart";
import type { AccountEnrichment } from "../../hooks/use-enrichment";

const ORDER = [
  "IT & infrastructure",
  "Data & AI",
  "Security",
  "Engineering",
  "Product & design",
  "Sales & marketing",
  "Operations & G&A",
  "Other",
];

/** Open roles by function per enrichment snapshot (stacked bars; fixed series colors per function). */
export function HiringTrend({ d }: { d: AccountEnrichment }) {
  const snaps = d.hiringHistory.filter((h) => h.value?.byFunction);
  if (!snaps.length) return null;
  const fns = ORDER.filter((f) => snaps.some((s) => s.value.byFunction[f]));
  const cats = snaps.map((s) => s.value.asOf);
  return (
    <section className="bg-card rounded-lg border p-4" aria-labelledby="hire-h">
      <h2 id="hire-h" className="text-sm font-semibold">
        Hiring trend by function
      </h2>
      <p className="text-muted-foreground mb-2 text-xs">
        Open roles on the public job board at each refresh (weekly).
      </p>
      <Chart
        label="Open roles by function over time"
        height={220}
        table={{
          columns: ["As of", ...fns, "Total"],
          rows: snaps.map((s) => [
            s.value.asOf,
            ...fns.map((f) => s.value.byFunction[f] ?? 0),
            s.value.total,
          ]),
        }}
        option={(t) => ({
          ...baseOption(t),
          grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
          legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
          tooltip: { ...baseOption(t).tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
          xAxis: categoryAxis(t, cats),
          yAxis: valueAxis(t),
          series: fns.map((f) => ({
            name: f,
            type: "bar",
            stack: "roles",
            ...barStyle(),
            itemStyle: {
              color: t.series[ORDER.indexOf(f) % t.series.length],
              borderColor: t.surface,
              borderWidth: 1,
            },
            data: snaps.map((s) => s.value.byFunction[f] ?? 0),
          })),
        })}
      />
    </section>
  );
}
