"use client";
import { useMemo } from "react";
import {
  Chart,
  barStyle,
  baseOption,
  categoryAxis,
  ordinalRamp,
  valueAxis,
} from "@/components/chart";
import { PRACTICE_AREA_IDS, practiceLabel } from "@/config/practice-areas";
import { CLOSE_REASON_LABELS, type CloseReason } from "@/lib/domain/enums";
import { formatPercent } from "@/lib/format";
import {
  closeReasons,
  cohortConversion,
  COHORT_MILESTONES,
  winLossByPractice,
  winLossByQuarter,
  winRateTakeaway,
} from "@/lib/pipeline/trends";
import type { PipelineOpp, StageEvent } from "@/lib/pipeline/types";
import { ChartCard } from "./analytics-view";

const q = (k: string) => k.replace("-", " ");
const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));
const days = (v: number | null) => (v === null ? "—" : `${Math.round(v)}d`);

/** Win/loss and pipeline trends (Phase 14), computed from the filtered rows. Counts only; no amounts. */
export function WinLossView({ opps, events }: { opps: PipelineOpp[]; events: StageEvent[] }) {
  const d = useMemo(() => {
    const now = new Date();
    const quarters = winLossByQuarter(opps, now, 6);
    return {
      quarters,
      takeaway: winRateTakeaway(quarters),
      practice: winLossByPractice(opps, PRACTICE_AREA_IDS, now, 4),
      cohorts: cohortConversion(opps, events, now, 6),
      reasons: closeReasons(opps, now, 4),
    };
  }, [opps, events]);
  const closedCount = d.quarters.reduce((s, x) => s + x.won + x.lost, 0);
  if (!closedCount)
    return (
      <p className="bg-card text-muted-foreground rounded-lg border p-4 text-[13px]">
        No deals closed in the last six quarters (with the current filters). Win/loss trends appear
        once deals close.
      </p>
    );
  const cats = d.quarters.map((x) => q(x.quarter));
  return (
    <div className="grid gap-4">
      {d.takeaway && (
        <p className="bg-card rounded-lg border px-4 py-3 text-[13px]" aria-live="polite">
          {d.takeaway}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Won and lost by quarter" description="Deals closed per quarter, by count">
          <Chart
            label="Won and lost deals by quarter"
            height={240}
            table={{
              columns: ["Quarter", "Won", "Lost", "Win rate"],
              rows: d.quarters.map((x) => [q(x.quarter), x.won, x.lost, pct(x.winRate)]),
            }}
            option={(t) => ({
              ...baseOption(t),
              legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
              grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
              tooltip: {
                ...baseOption(t).tooltip,
                trigger: "axis",
                axisPointer: { type: "shadow" },
              },
              xAxis: categoryAxis(t, cats),
              yAxis: valueAxis(t),
              series: [
                {
                  name: "Won",
                  type: "bar",
                  ...barStyle(),
                  itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
                  data: d.quarters.map((x) => x.won),
                },
                {
                  name: "Lost",
                  type: "bar",
                  ...barStyle(),
                  itemStyle: { color: t.series[1], borderRadius: [4, 4, 0, 0] },
                  data: d.quarters.map((x) => x.lost),
                },
              ],
            })}
          />
        </ChartCard>
        <ChartCard
          title="Win rate by quarter"
          description="Won ÷ (won + lost); gaps are quarters with nothing closed"
        >
          <Chart
            label="Win rate by quarter"
            height={240}
            table={{
              columns: ["Quarter", "Win rate"],
              rows: d.quarters.map((x) => [q(x.quarter), pct(x.winRate)]),
            }}
            option={(t) => ({
              ...baseOption(t),
              grid: { left: 8, right: 40, top: 16, bottom: 8, containLabel: true },
              tooltip: {
                ...baseOption(t).tooltip,
                trigger: "axis",
                valueFormatter: (v: unknown) => pct(Number(v)),
              },
              xAxis: categoryAxis(t, cats, { boundaryGap: false }),
              yAxis: { ...valueAxis(t, (v) => `${Math.round(v * 100)}%`), max: 1, min: 0 },
              series: [
                {
                  type: "line",
                  connectNulls: false,
                  symbol: "circle",
                  symbolSize: 8,
                  lineStyle: { width: 2, color: t.series[0] },
                  itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 2 },
                  data: d.quarters.map((x) => x.winRate),
                  endLabel: {
                    show: true,
                    color: t.ink2,
                    fontSize: t.fs,
                    formatter: (p: { value?: unknown }) => pct(Number(p.value)),
                  },
                },
              ],
            })}
          />
        </ChartCard>
        <ChartCard
          title="Sales cycle"
          description="Average days from created to won, by closing quarter"
        >
          <Chart
            label="Average sales cycle by quarter"
            height={220}
            table={{
              columns: ["Quarter", "Avg days to win", "Won deals"],
              rows: d.quarters.map((x) => [q(x.quarter), days(x.avgCycleDays), x.won]),
            }}
            option={(t) => ({
              ...baseOption(t),
              grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
              tooltip: {
                ...baseOption(t).tooltip,
                trigger: "axis",
                valueFormatter: (v: unknown) => days(Number(v)),
              },
              xAxis: categoryAxis(t, cats),
              yAxis: valueAxis(t, (v) => `${v}d`),
              series: [
                {
                  type: "bar",
                  ...barStyle(),
                  itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
                  data: d.quarters.map((x) =>
                    x.avgCycleDays === null ? null : Math.round(x.avgCycleDays),
                  ),
                  label: {
                    show: true,
                    position: "top",
                    color: t.ink2,
                    fontSize: t.fs,
                    formatter: (p: { value?: unknown }) => `${Number(p.value)}d`,
                  },
                },
              ],
            })}
          />
        </ChartCard>
        <ChartCard title="Win rate by practice" description="Last four quarters">
          <Chart
            label="Win rate by practice area"
            height={Math.max(160, d.practice.length * 32 + 24)}
            table={{
              columns: ["Practice", "Won", "Lost", "Win rate", "Avg days to win"],
              rows: d.practice.map((x) => [
                practiceLabel(x.practice),
                x.won,
                x.lost,
                pct(x.winRate),
                days(x.avgCycleDays),
              ]),
            }}
            option={(t) => ({
              ...baseOption(t),
              grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
              tooltip: {
                ...baseOption(t).tooltip,
                trigger: "item",
                valueFormatter: (v: unknown) => pct(Number(v)),
              },
              xAxis: {
                ...valueAxis(t, (v) => `${Math.round(v * 100)}%`),
                max: 1,
                splitLine: { show: false },
                axisLabel: { show: false },
              },
              yAxis: categoryAxis(
                t,
                d.practice.map((x) => practiceLabel(x.practice)),
                { inverse: true, axisLine: { show: false } },
              ),
              series: [
                {
                  type: "bar",
                  ...barStyle(true),
                  itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
                  data: d.practice.map((x) => x.winRate),
                  label: {
                    show: true,
                    position: "right",
                    color: t.ink2,
                    fontSize: t.fs,
                    formatter: (p: { dataIndex: number }) =>
                      `${pct(d.practice[p.dataIndex].winRate)} (${d.practice[p.dataIndex].won}/${d.practice[p.dataIndex].won + d.practice[p.dataIndex].lost})`,
                  },
                },
              ],
            })}
          />
        </ChartCard>
        <ChartCard
          title="Stage conversion by cohort"
          description="Deals created each quarter and how many reached each milestone so far (recent cohorts are still young)"
        >
          <Chart
            label="Stage conversion by creation cohort"
            height={240}
            table={{
              columns: [
                "Created in",
                "Created",
                "Reached Solution",
                "Reached Proposal",
                "Won",
                "Still open",
              ],
              rows: d.cohorts.map((c) => [
                q(c.quarter),
                c.created,
                c.reached.Solution,
                c.reached.Proposal,
                c.reached.ClosedWon,
                c.stillOpen,
              ]),
            }}
            option={(t) => {
              const ramp = ordinalRamp(t, 4);
              const names = ["Created", "Reached Solution", "Reached Proposal", "Won"];
              const vals = (i: number) =>
                d.cohorts.map((c) => (i === 0 ? c.created : c.reached[COHORT_MILESTONES[i - 1]]));
              return {
                ...baseOption(t),
                legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
                grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
                tooltip: {
                  ...baseOption(t).tooltip,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                },
                xAxis: categoryAxis(
                  t,
                  d.cohorts.map((c) => q(c.quarter)),
                ),
                yAxis: valueAxis(t),
                series: names.map((name, i) => ({
                  name,
                  type: "bar",
                  barGap: "10%",
                  barMaxWidth: 14,
                  itemStyle: { color: ramp[i], borderRadius: [4, 4, 0, 0] },
                  data: vals(i),
                })),
              };
            }}
          />
        </ChartCard>
        <ChartCard
          title="Why deals closed"
          description={`Close reasons you recorded, last four quarters${d.reasons.unrecorded ? ` · ${d.reasons.unrecorded} closed deal${d.reasons.unrecorded === 1 ? "" : "s"} without a reason` : ""}`}
        >
          {d.reasons.rows.length ? (
            <Chart
              label="Close reasons, won and lost"
              height={Math.max(160, d.reasons.rows.length * 32 + 48)}
              table={{
                columns: ["Reason", "Won", "Lost"],
                rows: d.reasons.rows.map((r) => [
                  CLOSE_REASON_LABELS[r.reason as CloseReason],
                  r.won,
                  r.lost,
                ]),
              }}
              option={(t) => ({
                ...baseOption(t),
                legend: { ...baseOption(t).legend, show: true, top: 0, left: 0 },
                grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
                tooltip: {
                  ...baseOption(t).tooltip,
                  trigger: "axis",
                  axisPointer: { type: "shadow" },
                },
                xAxis: { ...valueAxis(t), minInterval: 1 },
                yAxis: categoryAxis(
                  t,
                  d.reasons.rows.map((r) => CLOSE_REASON_LABELS[r.reason as CloseReason]),
                  { inverse: true },
                ),
                series: [
                  {
                    name: "Won",
                    type: "bar",
                    stack: "r",
                    barMaxWidth: 16,
                    itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 1 },
                    data: d.reasons.rows.map((r) => r.won),
                  },
                  {
                    name: "Lost",
                    type: "bar",
                    stack: "r",
                    barMaxWidth: 16,
                    itemStyle: {
                      color: t.series[1],
                      borderColor: t.surface,
                      borderWidth: 1,
                      borderRadius: [0, 4, 4, 0],
                    },
                    data: d.reasons.rows.map((r) => r.lost),
                  },
                ],
              })}
            />
          ) : (
            <p className="text-muted-foreground text-[13px]">
              No close reasons recorded yet. Pick one when you mark a deal won or lost (deal details
              → Close reason).
            </p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
