"use client";
import { useQuery } from "@tanstack/react-query";
import { StatTile } from "@/components/kpi/stat-tile";
import { SetTargetLink } from "@/components/kpi/target-hint";
import { coverageTone } from "@/lib/pipeline/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { formatCurrencyCompact, formatPercent } from "@/lib/format";
import { useWidgetPipeline } from "@/modules/opportunities/widgets/use-widget-pipeline";

/** KPI strip (spec 5.1): pipeline, weighted, active opps, win rate, cycle, coverage, new signals. */
export function HomeKpis() {
  const { a, isLoading } = useWidgetPipeline();
  const { data: sig } = useQuery({
    queryKey: ["dashboard", "signal-counts"],
    queryFn: () => api<{ h24: number; d7: number }>("/api/signals/counts"),
    refetchInterval: 60_000,
  });
  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px]" />
        ))}
      </div>
    );
  const k = a.kpis;
  const cov = k.coverageRatio;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <StatTile label="Pipeline" value={formatCurrencyCompact(k.pipelineTotal)} internal />
      <StatTile
        label="Weighted pipeline"
        value={formatCurrencyCompact(k.weightedPipeline)}
        internal
      />
      <StatTile label="Active opps" value={k.activeOpps} />
      <StatTile
        label="Win rate (12m)"
        value={k.winRate === null ? "—" : formatPercent(k.winRate)}
        internal
      />
      <StatTile
        label="Avg deal cycle"
        value={k.avgCycleDays === null ? "—" : `${Math.round(k.avgCycleDays)}d`}
      />
      <StatTile
        label="Coverage vs target"
        value={!k.targetSet ? "Not set" : cov === null ? "Met" : `${cov.toFixed(1)}×`}
        sub={
          !k.targetSet ? (
            <SetTargetLink />
          ) : k.coverageTarget > 0 ? (
            `target ${k.coverageTarget.toFixed(1)}×`
          ) : (
            "no coverage target set"
          )
        }
        tone={coverageTone(k)}
        internal
      />
      <StatTile
        label="Hot signals (24h)"
        value={sig ? sig.h24 : "—"}
        sub={sig ? `${sig.d7} in last 7 days` : undefined}
      />
    </div>
  );
}
