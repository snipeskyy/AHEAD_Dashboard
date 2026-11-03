"use client";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatTile } from "@/components/kpi/stat-tile";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { usePipelineAnalytics } from "../hooks/use-pipeline-data";
import { ForecastChart } from "./pipeline-charts";

type Analytics = ReturnType<typeof usePipelineAnalytics>;

export function ForecastView({ a }: { a: Analytics }) {
  const [grain, setGrain] = useState<"month" | "quarter">("quarter");
  const buckets = grain === "month" ? a.months : a.quarters;
  const target = grain === "month" ? a.settings.quarterlyTarget / 3 : a.settings.quarterlyTarget;
  const k = a.kpis;
  return (
    <div className="grid gap-4" data-internal-only="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="Quarterly target"
          value={formatCurrencyCompact(k.quarterlyTarget)}
          sub="Settings → Opportunities"
        />
        <StatTile
          label="Closed won this quarter"
          value={formatCurrencyCompact(k.wonThisQuarter)}
          sub={`${Math.round((k.wonThisQuarter / (k.quarterlyTarget || 1)) * 100)}% of target`}
        />
        <StatTile
          label="Pipeline closing this quarter"
          value={formatCurrencyCompact(k.pipelineThisQuarter)}
        />
        <StatTile
          label="Coverage"
          value={k.coverageRatio === null ? "Target met" : `${k.coverageRatio.toFixed(1)}×`}
          sub={`Target ${k.coverageTarget.toFixed(1)}×`}
          tone={
            k.coverageRatio === null || k.coverageRatio >= k.coverageTarget
              ? "good"
              : k.coverageRatio >= k.coverageTarget * 0.75
                ? "warning"
                : "critical"
          }
        />
        <StatTile
          label="Weighted pipeline"
          value={formatCurrencyCompact(k.weightedPipeline)}
          sub="Σ amount × probability"
        />
      </div>
      <section className="bg-card rounded-lg border p-4">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Forecast vs target</h2>
            <p className="text-muted-foreground text-xs">
              Open deals by close date; best case includes commit. Closed won by close date.
            </p>
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={grain}
            onValueChange={(v) => v && setGrain(v as "month" | "quarter")}
            aria-label="Forecast period"
          >
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="quarter">Quarter</ToggleGroupItem>
          </ToggleGroup>
        </header>
        <ForecastChart buckets={buckets} target={target} height={300} />
      </section>
      <section className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Forecast table</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              {[
                "Period",
                "Closed won",
                "Commit",
                "Best case",
                "Pipeline",
                "Weighted",
                "Gap to target",
              ].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={
                    i ? "px-4 py-2 text-right font-medium" : "px-4 py-2 text-left font-medium"
                  }
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const gap = target - b.closedWon - b.commit;
              return (
                <tr key={b.key} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    {b.key}
                  </th>
                  {[b.closedWon, b.commit, b.bestCase, b.pipeline, b.weighted].map((v, i) => (
                    <td key={i} className="tabular px-4 py-2 text-right">
                      {formatCurrency(v)}
                    </td>
                  ))}
                  <td
                    className={
                      gap > 0
                        ? "text-critical-text tabular px-4 py-2 text-right"
                        : "text-good-text tabular px-4 py-2 text-right"
                    }
                  >
                    {gap > 0 ? `−${formatCurrency(gap)}` : `+${formatCurrency(-gap)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
