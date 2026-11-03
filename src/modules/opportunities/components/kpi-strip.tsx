"use client";
import { StatTile } from "@/components/kpi/stat-tile";
import { formatCurrencyCompact, formatPercent } from "@/lib/format";
import type { Kpis } from "@/lib/pipeline/analytics";

export function PipelineKpiStrip({ k, extra }: { k: Kpis; extra?: React.ReactNode }) {
  const cov = k.coverageRatio;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Pipeline"
        value={formatCurrencyCompact(k.pipelineTotal)}
        sub={`${k.activeOpps} active opps`}
        internal
      />
      <StatTile
        label="Weighted pipeline"
        value={formatCurrencyCompact(k.weightedPipeline)}
        sub="amount × probability"
        internal
      />
      <StatTile
        label="Win rate"
        value={k.winRate === null ? "—" : formatPercent(k.winRate)}
        sub="closed, last 12 months"
        internal
      />
      <StatTile
        label="Avg deal cycle"
        value={k.avgCycleDays === null ? "—" : `${Math.round(k.avgCycleDays)} days`}
        sub="won deals, created → close"
      />
      <StatTile
        label="Coverage (this quarter)"
        value={cov === null ? "Target met" : `${cov.toFixed(1)}×`}
        sub={`target ${k.coverageTarget.toFixed(1)}× · ${formatCurrencyCompact(Math.max(0, k.quarterlyTarget - k.wonThisQuarter))} to go`}
        tone={
          cov === null || cov >= k.coverageTarget
            ? "good"
            : cov >= k.coverageTarget * 0.75
              ? "warning"
              : "critical"
        }
        internal
      />
      {extra}
    </div>
  );
}
