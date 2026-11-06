"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatTile } from "@/components/kpi/stat-tile";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { NeedsAccounts } from "@/components/states/needs-data";
import { Button } from "@/components/ui/button";
import { formatCurrencyCompact } from "@/lib/format";
import { TIERS } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";
import { MomentumList, NeglectedList } from "../components/account-lists";
import { FiscalTimeline } from "../components/fiscal-timeline";
import { useTerritory, type TerritoryRow } from "../components/use-territory";

const CADENCE_LABEL = { overdue: "Overdue", never: "Never touched", "due-soon": "Due soon", ok: "On cadence" } as const;
const CADENCE_TONE = { overdue: "text-critical-text", never: "text-critical-text", "due-soon": "text-warning-text", ok: "text-good-text" } as const;

export default function TerritoryPage() {
  const { data, isLoading, error, refetch } = useTerritory();
  const [tier, setTier] = useState<string>("All");
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => tier === "All" || r.tier === tier), [data, tier]);
  return (
    <PageContainer>
      <PageHeader
        title="Territory"
        description={`Coverage cadence by tier (${data ? `Strategic every ${data.cadence.Strategic}d · Growth ${data.cadence.Growth}d · Maintain ${data.cadence.Maintain}d` : "…"}). Edit cadence in Settings → Modules → Territory.`}
        actions={<Button size="sm" variant="outline" asChild><Link href="/fix-it">Fix-it queue</Link></Button>}
      />
      <NeedsAccounts what="Territory views">
        {isLoading ? <CardSkeleton lines={8} /> : error || !data ? <ErrorState error={error} onRetry={() => refetch()} /> : (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {TIERS.map((t) => {
                const tr = data.rows.filter((r) => r.tier === t);
                const off = tr.filter((r) => r.cadence.status === "overdue" || r.cadence.status === "never").length;
                return <StatTile key={t} label={`${t} accounts`} value={tr.length} sub={`${off} past cadence`} tone={off ? "warning" : "good"} />;
              })}
              <StatTile label="In budget planning now" value={data.rows.filter((r) => r.fiscal?.phase === "in-window").length} sub="likely, from fiscal year ends" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="bg-card rounded-lg border p-4" aria-labelledby="neg-h">
                <h2 id="neg-h" className="text-sm font-semibold">Neglected accounts</h2>
                <p className="text-muted-foreground mb-1 text-xs">Past their tier&apos;s touch cadence, Strategic first.</p>
                {data.neglected.length ? <NeglectedList rows={data.neglected} /> : <p className="text-muted-foreground py-4 text-sm">Every account is within cadence.</p>}
              </section>
              <section className="bg-card rounded-lg border p-4" aria-labelledby="mom-h">
                <h2 id="mom-h" className="text-sm font-semibold">Most momentum</h2>
                <p className="text-muted-foreground mb-1 text-xs">Last 14 days: relevant signals, stage moves, touches and new opportunities.</p>
                {data.momentum.length ? <MomentumList rows={data.momentum} /> : <p className="text-muted-foreground py-4 text-sm">No activity in the last 14 days.</p>}
              </section>
            </div>
            <section className="bg-card rounded-lg border p-4" aria-labelledby="fy-h">
              <h2 id="fy-h" className="text-sm font-semibold">Budget timing</h2>
              <p className="text-muted-foreground mb-2 text-xs">Likely planning windows from each fiscal year end (SEC or entered by you). Estimates, not facts.</p>
              {data.rows.some((r) => r.fiscal) ? <FiscalTimeline rows={data.rows} /> : <p className="text-muted-foreground py-4 text-sm">No fiscal year ends yet. Enrich public companies or type them on the Profile tab.</p>}
            </section>
            <section className="bg-card overflow-x-auto rounded-lg border" aria-labelledby="all-h" tabIndex={0} role="region" aria-label="All accounts by tier">
              <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
                <h2 id="all-h" className="text-sm font-semibold">All accounts</h2>
                <div className="flex gap-1" role="group" aria-label="Filter by tier">
                  {["All", ...TIERS].map((t) => <Button key={t} size="sm" variant={tier === t ? "default" : "ghost"} className="h-7" onClick={() => setTier(t)} aria-pressed={tier === t}>{t}</Button>)}
                </div>
              </header>
              <table className="mt-2 w-full text-left text-[13px]">
                <thead className="text-muted-foreground border-b text-xs"><tr>{["Account", "Tier", "Health", "Last touch", "Cadence", "Whitespace", "Open pipeline", "Budget timing"].map((h) => <th key={h} className="px-4 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y">{rows.map((r) => <Row key={r.id} r={r} />)}</tbody>
              </table>
            </section>
          </div>
        )}
      </NeedsAccounts>
    </PageContainer>
  );
}

function Row({ r }: { r: TerritoryRow }) {
  return (
    <tr>
      <td className="px-4 py-2"><Link href={`/accounts/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
      <td className="px-4 py-2">{r.tier}</td>
      <td className="tabular px-4 py-2">{Math.round(r.healthScore)}</td>
      <td className="px-4 py-2 whitespace-nowrap">{r.cadence.daysSinceTouch === null ? "—" : `${r.cadence.daysSinceTouch}d ago`}</td>
      <td className={cn("px-4 py-2 whitespace-nowrap", CADENCE_TONE[r.cadence.status])}>{CADENCE_LABEL[r.cadence.status]}</td>
      <td className="tabular px-4 py-2">{Math.round(r.whitespaceScore)}</td>
      <td className="tabular px-4 py-2" data-internal-only="true" data-field="opp.amount">{formatCurrencyCompact(r.openPipeline)}</td>
      <td className="text-muted-foreground px-4 py-2 text-xs">{r.fiscal?.label ?? "—"}</td>
    </tr>
  );
}
