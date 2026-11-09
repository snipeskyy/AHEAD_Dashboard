"use client";
import { useMemo, useState } from "react";
import { Chart } from "@/components/chart/chart";
import { barStyle, baseOption, categoryAxis, valueAxis } from "@/components/chart/theme";
import { StatTile } from "@/components/kpi/stat-tile";
import { computeTco, sensitivity } from "@/lib/tco/compute";
import { CHART_GROUPS, type TcoModel } from "@/lib/tco/model";
import { money } from "./use-case";

const labelsFor = (by: Record<string, number[]>, cats: string[]) =>
  by[cats[0]].map((_, y) => cats.reduce((s, c) => s + (by[c]?.[y] ?? 0), 0));
const yearLabels = (n: number) =>
  Array.from({ length: n + 1 }, (_, y) => (y === 0 ? "Upfront" : `Year ${y}`));
const short = (n: number) => money(n).replace(".00", "");
/** Tiles and axes: compact ($541K, $1.23M) so headline numbers never truncate. */
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: Math.abs(n) >= 1e6 ? 2 : 0,
  }).format(n);
const pctText = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
const yearsText = (v: number | null) =>
  v === null ? "Not within the period" : v === 0 ? "Immediate" : `${v.toFixed(1)} years`;

/** Headline numbers, cumulative cost, cost by category and the sensitivity tornado. Every chart has a table. */
export function Results({ model }: { model: TcoModel }) {
  const r = useMemo(() => computeTco(model), [model]);
  const [target, setTarget] = useState<string | null>(null);
  const cmp = r.comparisons.find((c) => c.id === target) ?? r.comparisons[0];
  const tornado = useMemo(() => (cmp ? sensitivity(model, cmp.id) : []), [model, cmp]);
  const [catScenario, setCatScenario] = useState<string | null>(null);
  const cs = r.scenarios.find((s) => s.id === catScenario) ?? r.scenarios[0];
  const groups = CHART_GROUPS.map((g, color) => ({
    ...g,
    color,
    values: labelsFor(cs.byCategory, g.categories),
  })).filter((g) => g.values.some((v) => v));
  const labels = yearLabels(r.years);
  const empty = r.scenarios.every((s) => s.total === 0);
  const sel = "border-input dark:bg-input/30 h-7 rounded-md border bg-transparent px-1.5 text-xs";

  if (empty)
    return (
      <p className="text-muted-foreground bg-card rounded-lg border p-6 text-[13px]">
        Enter costs on the left to see the comparison. Every number here comes from the assumptions
        you enter.
      </p>
    );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {r.scenarios.map((s) => (
          <StatTile
            key={s.id}
            label={`${r.years}-yr TCO · ${s.name}`}
            value={compact(s.total)}
            sub={`NPV ${compact(s.npv)}${s.id === r.baseline.id ? " · baseline" : ""}`}
          />
        ))}
      </div>
      {cmp && (
        <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Business case">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {r.baseline.name} vs
            {r.comparisons.length > 1 ? (
              <select
                aria-label="Compare against"
                className={sel}
                value={cmp.id}
                onChange={(e) => setTarget(e.target.value)}
              >
                {r.comparisons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <span>{cmp.name}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
            <StatTile
              label="Total savings"
              value={compact(cmp.totalSavings)}
              tone={cmp.totalSavings >= 0 ? "good" : "critical"}
              sub={cmp.totalSavings >= 0 ? "lower cost" : "higher cost"}
            />
            <StatTile label="Savings vs baseline" value={pctText(cmp.savingsPct)} />
            <StatTile
              label={`NPV of savings @ ${model.discountRatePct}%`}
              value={compact(cmp.npvSavings)}
            />
            <StatTile label="Payback" value={yearsText(cmp.paybackYears)} />
            <StatTile
              label="IRR"
              value={pctText(cmp.irr)}
              sub={cmp.irr === null ? "needs an upfront investment" : undefined}
            />
          </div>
          {tornado.length > 0 && (
            <Chart
              label={`Sensitivity: change in NPV of savings (base ${cmp ? compact(cmp.npvSavings) : ""}) when each assumption moves ±20%`}
              height={Math.max(180, tornado.length * 34 + 40)}
              table={{
                columns: ["Assumption", "Change if −20%", "Change if +20%"],
                rows: tornado.map((d) => [d.label, short(d.low - d.base), short(d.high - d.base)]),
              }}
              option={(t) => ({
                ...baseOption(t),
                legend: { ...baseOption(t).legend, show: true, bottom: 0 },
                tooltip: {
                  ...baseOption(t).tooltip,
                  trigger: "axis",
                  valueFormatter: (v: unknown) => short(Number(v)),
                },
                grid: { left: 8, right: 24, top: 8, bottom: 28, containLabel: true },
                xAxis: valueAxis(t, (v) => compact(v)),
                yAxis: categoryAxis(
                  t,
                  tornado.map((d) => d.label),
                  { inverse: true },
                ),
                series: [
                  {
                    name: "Assumption −20% (lower)",
                    type: "bar",
                    ...barStyle(true),
                    itemStyle: { color: t.series[0] },
                    stack: "swing", // diverging around the base case
                    data: tornado.map((d) => Math.round(d.low - d.base)),
                  },
                  {
                    name: "Assumption +20% (higher)",
                    type: "bar",
                    ...barStyle(true),
                    itemStyle: { color: t.series[1] },
                    stack: "swing",
                    data: tornado.map((d) => Math.round(d.high - d.base)),
                  },
                ],
              })}
            />
          )}
        </section>
      )}
      <section className="bg-card rounded-lg border p-4" aria-label="Cumulative cost">
        <h3 className="mb-2 text-sm font-semibold">Cumulative cost</h3>
        <Chart
          label="Cumulative cost by scenario"
          height={260}
          table={{
            columns: ["Year", ...r.scenarios.map((s) => s.name)],
            rows: labels.map((l, y) => [l, ...r.scenarios.map((s) => short(s.cumulative[y]))]),
          }}
          option={(t) => ({
            ...baseOption(t),
            legend: { ...baseOption(t).legend, show: r.scenarios.length > 1, bottom: 0 },
            tooltip: {
              ...baseOption(t).tooltip,
              trigger: "axis",
              valueFormatter: (v: unknown) => short(Number(v)),
            },
            grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
            xAxis: categoryAxis(t, labels),
            yAxis: valueAxis(t, (v) => compact(v)),
            series: r.scenarios.map((s, i) => ({
              name: s.name,
              type: "line",
              data: s.cumulative,
              symbolSize: 8,
              lineStyle: { width: 2, color: t.series[i] },
              itemStyle: { color: t.series[i] },
            })),
          })}
        />
      </section>
      <section className="bg-card rounded-lg border p-4" aria-label="Cost by category">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Cost by category</h3>
          <select
            aria-label="Scenario for cost breakdown"
            className={sel}
            value={cs.id}
            onChange={(e) => setCatScenario(e.target.value)}
          >
            {r.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Chart
          label={`Annual cost by category: ${cs.name}`}
          height={260}
          table={{
            columns: ["Category", ...labels],
            rows: groups.map((g) => [g.label, ...g.values.map(short)]),
          }}
          option={(t) => ({
            ...baseOption(t),
            legend: { ...baseOption(t).legend, show: groups.length > 1, bottom: 0 },
            tooltip: {
              ...baseOption(t).tooltip,
              trigger: "axis",
              valueFormatter: (v: unknown) => short(Number(v)),
            },
            grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
            xAxis: categoryAxis(t, labels),
            yAxis: valueAxis(t, (v) => compact(v)),
            series: groups.map((g) => ({
              name: g.label,
              type: "bar",
              stack: "cost",
              barMaxWidth: 36,
              itemStyle: { color: t.series[g.color], borderColor: t.surface, borderWidth: 1 },
              data: g.values,
            })),
          })}
        />
      </section>
    </div>
  );
}
