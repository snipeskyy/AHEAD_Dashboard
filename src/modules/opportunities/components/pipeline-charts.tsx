"use client";
import { format, parse } from "date-fns";
import {
  Chart,
  barStyle,
  baseOption,
  categoryAxis,
  ordinalRamp,
  valueAxis,
} from "@/components/chart";
import { practiceLabel } from "@/config/practice-areas";
import { STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/format";
import { AGE_BUCKETS, type ForecastBucket } from "@/lib/pipeline/analytics";

const money = (v: number) => formatCurrencyCompact(v);
const stageLabel = (s: string) => STAGE_LABELS[s as Stage] ?? s;
const periodLabel = (k: string) =>
  k.includes("Q") ? k.replace("-", " ") : format(parse(k, "yyyy-MM", new Date()), "MMM yy");

/** Open pipeline by stage — ordered categories use the ordinal ramp. */
export function StageFunnelChart({
  data,
  height = 220,
  onSelect,
}: {
  data: Array<{ stage: string; amount: number; count: number }>;
  height?: number;
  onSelect?: (stage: string) => void;
}) {
  const cats = data.map((d) => stageLabel(d.stage));
  return (
    <Chart
      label="Open pipeline by stage"
      height={height}
      table={{
        columns: ["Stage", "Deals", "Amount"],
        rows: data.map((d) => [stageLabel(d.stage), d.count, formatCurrency(d.amount)]),
      }}
      onClick={onSelect ? (p) => onSelect(data[p.dataIndex].stage) : undefined}
      option={(t) => {
        const ramp = ordinalRamp(t, data.length);
        return {
          ...baseOption(t),
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...baseOption(t).tooltip,
            trigger: "item",
            valueFormatter: (v: unknown) => formatCurrency(Number(v)),
          },
          xAxis: { ...valueAxis(t, money), splitLine: { show: false }, axisLabel: { show: false } },
          yAxis: categoryAxis(t, cats, { inverse: true, axisLine: { show: false } }),
          series: [
            {
              type: "bar",
              ...barStyle(true),
              data: data.map((d, i) => ({
                value: d.amount,
                itemStyle: { color: ramp[i], borderRadius: [0, 4, 4, 0] },
              })),
              label: {
                show: true,
                position: "right",
                color: t.ink2,
                fontSize: 11,
                formatter: (p: { value?: unknown }) => money(Number(p.value)),
              },
            },
          ],
        };
      }}
    />
  );
}

/** Open pipeline by practice area — single series, single hue. */
export function PracticeBarChart({
  data,
  height = 240,
}: {
  data: Array<{ practiceArea: string; amount: number; count: number }>;
  height?: number;
}) {
  const rows = data.filter((d) => d.amount > 0);
  return (
    <Chart
      label="Open pipeline by practice area"
      height={height}
      table={{
        columns: ["Practice", "Deals", "Amount"],
        rows: rows.map((d) => [practiceLabel(d.practiceArea), d.count, formatCurrency(d.amount)]),
      }}
      option={(t) => ({
        ...baseOption(t),
        grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "item",
          valueFormatter: (v: unknown) => formatCurrency(Number(v)),
        },
        xAxis: { ...valueAxis(t, money), splitLine: { show: false }, axisLabel: { show: false } },
        yAxis: categoryAxis(
          t,
          rows.map((d) => practiceLabel(d.practiceArea, true)),
          { inverse: true, axisLine: { show: false } },
        ),
        series: [
          {
            type: "bar",
            ...barStyle(true),
            itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
            data: rows.map((d) => d.amount),
            label: {
              show: true,
              position: "right",
              color: t.ink2,
              fontSize: 11,
              formatter: (p: { value?: unknown }) => money(Number(p.value)),
            },
          },
        ],
      })}
    />
  );
}

/**
 * Forecast vs target. Commit ⊂ Best case ⊂ Pipeline is ordered → ordinal ramp;
 * Closed won is a distinct identity hue; target is a reference line on the same axis.
 */
export function ForecastChart({
  buckets,
  target,
  height = 280,
  compact = false,
}: {
  buckets: ForecastBucket[];
  target: number;
  height?: number;
  compact?: boolean;
}) {
  const cats = buckets.map((b) => periodLabel(b.key));
  const series = [
    { name: "Closed won", key: "closedWon" as const },
    { name: "Commit", key: "commit" as const },
    { name: "Best case", key: "bestCase" as const },
    ...(compact ? [] : [{ name: "Pipeline", key: "pipeline" as const }]),
  ];
  return (
    <Chart
      label="Forecast versus target by period"
      height={height}
      table={{
        columns: ["Period", ...series.map((s) => s.name), "Target"],
        rows: buckets.map((b) => [
          periodLabel(b.key),
          ...series.map((s) => formatCurrency(b[s.key])),
          formatCurrency(target),
        ]),
      }}
      option={(t) => {
        const ramp = ordinalRamp(t, 4);
        const colors: Record<string, string> = {
          closedWon: t.series[2],
          commit: ramp[3],
          bestCase: ramp[1],
          pipeline: ramp[0],
        };
        return {
          ...baseOption(t),
          grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
          legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
          tooltip: {
            ...baseOption(t).tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            valueFormatter: (v: unknown) => formatCurrency(Number(v)),
          },
          xAxis: categoryAxis(t, cats),
          yAxis: valueAxis(t, money),
          series: series.map((s, i) => ({
            name: s.name,
            type: "bar",
            ...barStyle(),
            barGap: "8%",
            itemStyle: { color: colors[s.key], borderRadius: [4, 4, 0, 0] },
            data: buckets.map((b) => b[s.key]),
            ...(i === 0
              ? {
                  markLine: {
                    symbol: "none",
                    silent: true,
                    lineStyle: { color: t.ink2, width: 1.5, type: "solid" },
                    label: {
                      formatter: `Target ${money(target)}`,
                      color: t.ink2,
                      fontSize: 11,
                      position: "insideStartTop",
                    },
                    data: [{ yAxis: target }],
                  },
                }
              : {}),
          })),
        };
      }}
    />
  );
}

export function ConversionChart({
  data,
  height = 220,
}: {
  data: Array<{ stage: string; reached: number; advanced: number; rate: number | null }>;
  height?: number;
}) {
  return (
    <Chart
      label="Stage-to-stage conversion rate"
      height={height}
      table={{
        columns: ["Stage", "Reached", "Advanced", "Conversion"],
        rows: data.map((d) => [
          stageLabel(d.stage),
          d.reached,
          d.advanced,
          d.rate === null ? "—" : formatPercent(d.rate),
        ]),
      }}
      option={(t) => ({
        ...baseOption(t),
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "item",
          valueFormatter: (v: unknown) => formatPercent(Number(v)),
        },
        xAxis: categoryAxis(
          t,
          data.map((d) => stageLabel(d.stage)),
        ),
        yAxis: { ...valueAxis(t, (v: number) => formatPercent(v)), max: 1 },
        series: [
          {
            type: "bar",
            ...barStyle(),
            itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
            data: data.map((d) => d.rate ?? 0),
            label: {
              show: true,
              position: "top",
              color: t.ink2,
              fontSize: 11,
              formatter: (p: { value?: unknown }) => formatPercent(Number(p.value)),
            },
          },
        ],
      })}
    />
  );
}

export function VelocityChart({
  data,
  height = 220,
}: {
  data: Array<{ stage: string; avgDays: number | null; samples: number }>;
  height?: number;
}) {
  return (
    <Chart
      label="Average days spent in each stage"
      height={height}
      table={{
        columns: ["Stage", "Avg days", "Samples"],
        rows: data.map((d) => [
          stageLabel(d.stage),
          d.avgDays === null ? "—" : Math.round(d.avgDays),
          d.samples,
        ]),
      }}
      option={(t) => ({
        ...baseOption(t),
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "item",
          valueFormatter: (v: unknown) => `${Math.round(Number(v))} days`,
        },
        xAxis: categoryAxis(
          t,
          data.map((d) => stageLabel(d.stage)),
        ),
        yAxis: valueAxis(t, (v: number) => `${v}d`),
        series: [
          {
            type: "bar",
            ...barStyle(),
            itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
            data: data.map((d) => Math.round(d.avgDays ?? 0)),
            label: {
              show: true,
              position: "top",
              color: t.ink2,
              fontSize: 11,
              formatter: (p: { value?: unknown }) => `${Number(p.value)}d`,
            },
          },
        ],
      })}
    />
  );
}

/** Aging: stacked by ordered age buckets (ordinal ramp), 2px surface gap between segments. */
export function AgingChart({
  data,
  height = 240,
}: {
  data: Array<{ stage: string; buckets: number[] }>;
  height?: number;
}) {
  return (
    <Chart
      label="Open pipeline aging by stage"
      height={height}
      table={{
        columns: ["Stage", ...AGE_BUCKETS],
        rows: data.map((d) => [stageLabel(d.stage), ...d.buckets.map((b) => formatCurrency(b))]),
      }}
      option={(t) => {
        const ramp = ordinalRamp(t, 4);
        return {
          ...baseOption(t),
          grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
          legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
          tooltip: {
            ...baseOption(t).tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            valueFormatter: (v: unknown) => formatCurrency(Number(v)),
          },
          xAxis: categoryAxis(
            t,
            data.map((d) => stageLabel(d.stage)),
          ),
          yAxis: valueAxis(t, money),
          series: AGE_BUCKETS.map((name, i) => ({
            name,
            type: "bar",
            stack: "age",
            barMaxWidth: 24,
            itemStyle: {
              color: ramp[i],
              borderColor: t.surface,
              borderWidth: 1,
              borderRadius: i === AGE_BUCKETS.length - 1 ? [4, 4, 0, 0] : 0,
            },
            data: data.map((d) => d.buckets[i]),
          })),
        };
      }}
    />
  );
}

export function CreationTrendChart({
  data,
  height = 220,
}: {
  data: Array<{ month: string; amount: number; count: number }>;
  height?: number;
}) {
  // The current month is partial — label it so a dip doesn't read as a trend.
  const cats = data.map((d, i) =>
    i === data.length - 1 ? `${periodLabel(d.month)} (MTD)` : periodLabel(d.month),
  );
  return (
    <Chart
      label="New pipeline created per month"
      height={height}
      table={{
        columns: ["Month", "Deals created", "Amount"],
        rows: data.map((d) => [periodLabel(d.month), d.count, formatCurrency(d.amount)]),
      }}
      option={(t) => ({
        ...baseOption(t),
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "axis",
          valueFormatter: (v: unknown) => formatCurrency(Number(v)),
        },
        xAxis: categoryAxis(t, cats, { boundaryGap: false }),
        yAxis: valueAxis(t, money),
        series: [
          {
            type: "line",
            data: data.map((d) => d.amount),
            smooth: false,
            symbol: "circle",
            symbolSize: 7,
            showSymbol: false,
            lineStyle: { width: 2, color: t.series[0] },
            itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 2 },
            areaStyle: { color: t.series[0], opacity: 0.1 },
            endLabel: {
              show: true,
              color: t.ink2,
              fontSize: 11,
              formatter: (p: { value?: unknown }) => money(Number(p.value)),
            },
          },
        ],
        grid: { left: 8, right: 48, top: 16, bottom: 8, containLabel: true },
      })}
    />
  );
}
