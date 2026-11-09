"use client";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useMemo } from "react";
import { Chart } from "@/components/chart/chart";
import { baseOption, categoryAxis, valueAxis } from "@/components/chart/theme";
import { StatTile } from "@/components/kpi/stat-tile";
import { failures, growth, roomCalc, type Issue, type RoomCalc } from "../lib/calc";
import type { SandboxSpec } from "../lib/spec";
import type { ComponentLibrary } from "../lib/types";

const kw = (n: number) => `${n >= 100 ? Math.round(n) : n.toFixed(1)} kW`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const ICON = { critical: XCircle, warning: AlertTriangle, info: Info } as const;

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length)
    return (
      <p className="text-good-text inline-flex items-center gap-1.5 text-[13px]">
        <CheckCircle2 className="size-4" aria-hidden /> No capacity issues found.
      </p>
    );
  return (
    <ul className="grid gap-1.5 text-[13px]" aria-label="Capacity issues">
      {issues.map((i, n) => {
        const Icon = ICON[i.severity];
        return (
          <li key={n} className="flex items-start gap-1.5">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${i.severity === "critical" ? "text-critical-text" : i.severity === "warning" ? "text-warning-text" : "text-muted-foreground"}`}
              aria-hidden
            />
            <span>
              <span className="sr-only">{i.severity}: </span>
              {i.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function CapacityTiles({ c }: { c: RoomCalc }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <StatTile
        label="IT load / UPS"
        value={kw(c.drawKw)}
        sub={`${pct(c.drawKw, c.upsCapacityKw)} of ${kw(c.upsCapacityKw)}`}
        tone={c.drawKw > c.upsCapacityKw ? "critical" : undefined}
      />
      <StatTile
        label="Heat to air / capacity"
        value={kw(c.airKw)}
        sub={`${pct(c.airKw, c.airCapacityKw)} of ${kw(c.airCapacityKw)}`}
        tone={c.airKw > c.airCapacityKw ? "critical" : undefined}
      />
      <StatTile
        label="Heat to liquid / CDU"
        value={kw(c.liquidKw)}
        sub={
          c.liquidKw || c.liquidCapacityKw
            ? `${pct(c.liquidKw, c.liquidCapacityKw)} of ${kw(c.liquidCapacityKw)}`
            : "no liquid cooling"
        }
        tone={c.liquidKw > c.liquidCapacityKw ? "critical" : undefined}
      />
      <StatTile label="PUE (estimate)" value={c.pue ? c.pue.toFixed(2) : "—"} sub="see formulas" />
      <StatTile
        label="Floor space used"
        value={pct(c.whitespaceUtilization, 1)}
        sub={`${c.racks.length} racks · ${Math.round(c.areaM2)} m²`}
      />
      <StatTile label="Rack units used" value={pct(c.uUtilization, 1)} />
    </div>
  );
}

/** Capacity, growth runway, failure what-ifs and the formulas behind every number. */
export function CapacityPanel({ spec, lib }: { spec: SandboxSpec; lib: ComponentLibrary }) {
  const c = useMemo(() => roomCalc(spec, lib), [spec, lib]);
  const g = useMemo(() => growth(spec, lib), [spec, lib]);
  const f = useMemo(() => failures(spec, lib), [spec, lib]);
  const years = g.series.map((_, i) => (i === 0 ? "Now" : `Year ${i}`));
  return (
    <div className="grid gap-4">
      <CapacityTiles c={c} />
      <section className="bg-card rounded-lg border p-4" aria-label="Issues">
        <h3 className="mb-2 text-sm font-semibold">Issues</h3>
        <IssueList issues={c.issues} />
      </section>
      <section className="bg-card rounded-lg border p-4" aria-label="Growth runway">
        <h3 className="text-sm font-semibold">Growth runway</h3>
        <p className="text-muted-foreground mb-2 text-xs">
          At {spec.assumptions.growthPctPerYear}%/yr, IT load reaches the{" "}
          {g.binding.label.toLowerCase()} limit ({kw(g.binding.kw)} of IT load){" "}
          {g.yearsLeft === null
            ? "not within the projection"
            : g.yearsLeft === 0
              ? "already"
              : `in about ${g.yearsLeft.toFixed(1)} years`}
          .
        </p>
        <Chart
          label="Projected IT load against the binding capacity limit"
          height={220}
          table={{
            columns: ["Year", "Projected IT load (kW)", `${g.binding.label} limit (kW)`],
            rows: years.map((y, i) => [y, Math.round(g.series[i]), Math.round(g.binding.kw)]),
          }}
          option={(t) => ({
            ...baseOption(t),
            tooltip: {
              ...baseOption(t).tooltip,
              trigger: "axis",
              valueFormatter: (v: unknown) => `${Math.round(Number(v))} kW`,
            },
            grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
            xAxis: categoryAxis(t, years),
            yAxis: valueAxis(t, (v) => `${Math.round(v)} kW`),
            series: [
              {
                name: "Projected IT load",
                type: "line",
                data: g.series.map(Math.round),
                symbolSize: 8,
                lineStyle: { width: 2, color: t.series[0] },
                itemStyle: { color: t.series[0] },
                markLine: {
                  symbol: "none",
                  lineStyle: { color: t.ink2, type: "dashed" },
                  label: { formatter: `${g.binding.label} limit`, color: t.ink2, fontSize: t.fs },
                  data: [{ yAxis: Math.round(g.binding.kw) }],
                },
              },
            ],
          })}
        />
      </section>
      <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Failure what-ifs">
        <h3 className="text-sm font-semibold">Failure what-ifs</h3>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Cooling unit failures"
        >
          <table className="w-full text-[13px]">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-1 pr-3 font-medium">If this unit fails</th>
                <th className="pr-3 font-medium">Remaining capacity</th>
                <th className="pr-3 font-medium">Heat to remove</th>
                <th className="font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {f.cooling.map((x) => (
                <tr key={x.unit.id}>
                  <td className="py-1 pr-3">
                    {x.unit.label} ({x.unit.kind.toUpperCase()})
                  </td>
                  <td className="tabular pr-3">{kw(x.remainingKw)}</td>
                  <td className="tabular pr-3">{kw(x.heatKw)}</td>
                  <td className={x.ok ? "text-good-text" : "text-critical-text"}>
                    {x.ok ? "✓ Holds" : "✗ Overheats"}
                  </td>
                </tr>
              ))}
              {!f.cooling.length && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-2 text-xs">
                    No cooling units placed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[13px]">
          <span className="font-medium">If power feed A fails: </span>
          {f.feedA.filter((x) => x.status === "down").length} racks go down (single feed),{" "}
          {f.feedA.filter((x) => x.status === "overload").length} overload feed B,{" "}
          {f.feedA.filter((x) => x.status === "ok").length} keep running.
        </p>
      </section>
      <details className="bg-card rounded-lg border p-4 text-xs">
        <summary className="cursor-pointer text-sm font-semibold">
          How these numbers are calculated
        </summary>
        <ul className="text-muted-foreground mt-2 grid list-disc gap-1 pl-5">
          {c.formulas.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2">
          Illustrative, not vendor-certified. Use for early sizing conversations only.
        </p>
      </details>
    </div>
  );
}
