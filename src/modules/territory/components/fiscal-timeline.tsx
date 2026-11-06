"use client";
import { useState } from "react";
import { Chart, baseOption, categoryAxis } from "@/components/chart";
import type { TerritoryRow } from "./use-territory";

const DAY = 86_400_000;

/**
 * Budget timing across the portfolio: for each account, the likely planning window (bar) and the next
 * fiscal-year start (marker), over the next 12 months. Soonest windows first.
 */
export function FiscalTimeline({ rows, height = 320, max = 15 }: { rows: TerritoryRow[]; height?: number; max?: number }) {
  const [now] = useState(() => Date.now());
  const items = rows
    .filter((r) => r.fiscal)
    .map((r) => ({ r, s: Math.max(0, (Date.parse(r.fiscal!.start) - now) / DAY), e: Math.max(0, (Date.parse(r.fiscal!.end) - now) / DAY), fy: (Date.parse(r.fiscal!.fiscalYearStart) - now) / DAY }))
    .filter((x) => x.fy <= 400)
    .sort((a, b) => a.s - b.s || a.e - b.e)
    .slice(0, max)
    .reverse();
  const names = items.map((x) => x.r.name);
  const month = (d: number) => new Date(now + d * DAY).toLocaleDateString("en-US", { month: "short" });
  return (
    <Chart
      label="Likely budget planning windows by account"
      height={Math.max(height, items.length * 22 + 60)}
      table={{
        columns: ["Account", "Fiscal year starts", "Planning window (likely)", "Status"],
        rows: [...items].reverse().map((x) => [x.r.name, new Date(x.r.fiscal!.fiscalYearStart).toLocaleDateString(), `${new Date(x.r.fiscal!.start).toLocaleDateString()} – ${new Date(x.r.fiscal!.end).toLocaleDateString()}`, x.r.fiscal!.label]),
      }}
      option={(t) => ({
        ...baseOption(t),
        grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        legend: { ...baseOption(t).legend, show: true, top: 0, left: 0, data: ["Planning window", "Fiscal year starts"] },
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (p: unknown) => {
            const x = items[(p as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0];
            return x ? `<b>${x.r.name}</b><br/>${x.r.fiscal!.label}` : "";
          },
        },
        xAxis: { type: "value", min: 0, max: 365, interval: 30.4, axisLabel: { color: t.muted, fontSize: t.fs, formatter: (v: number) => month(v) }, splitLine: { lineStyle: { color: t.grid } } },
        yAxis: categoryAxis(t, names),
        series: [
          { name: "offset", type: "bar", stack: "w", silent: true, itemStyle: { color: "transparent" }, data: items.map((x) => x.s) },
          { name: "Planning window", type: "bar", stack: "w", barMaxWidth: 12, itemStyle: { color: t.series[0], borderRadius: 4 }, data: items.map((x) => Math.max(1, x.e - x.s)) },
          { name: "Fiscal year starts", type: "scatter", symbol: "diamond", symbolSize: 10, itemStyle: { color: t.series[3], borderColor: t.surface, borderWidth: 2 }, data: items.map((x, i) => [Math.max(0, x.fy), i]) },
        ],
      })}
    />
  );
}
