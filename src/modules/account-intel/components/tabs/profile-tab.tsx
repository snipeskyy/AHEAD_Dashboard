"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertCircle, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { CardSkeleton, ErrorState } from "@/components/states";
import { useAccountEnrichment } from "../../hooks/use-enrichment";
import { FinancialSnapshot } from "../enrichment/financial-snapshot";
import { HierarchyTree } from "../enrichment/hierarchy-tree";
import { HiringTrend } from "../enrichment/hiring-trend";
import { ManualPrompts } from "../enrichment/manual-prompts";
import { ProfileFields } from "../enrichment/profile-fields";
import { ProposalsPanel } from "../enrichment/proposals-panel";
import { CompletenessMeter, EnrichStatusBadge } from "../enrichment/status-badge";

/** Public profile: review proposals, every field with provenance, financials, hierarchy, hiring, and manual gaps. */
export function ProfileTab({ accountId, accountName }: { accountId: string; accountName: string }) {
  const { data: d, isLoading, error, refetch } = useAccountEnrichment(accountId);
  if (isLoading) return <CardSkeleton lines={8} />;
  if (error || !d) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="grid gap-4">
      <section
        className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-3 text-[13px]"
        aria-label="Enrichment status"
      >
        <EnrichStatusBadge status={d.status} pending={d.proposals.length} className="text-[13px]" />
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">Completeness</span>{" "}
          <CompletenessMeter pct={d.completeness} />
        </span>
        <span className="text-muted-foreground">
          {d.identityConfirmedAt
            ? `Identity confirmed ${formatDistanceToNowStrict(new Date(d.identityConfirmedAt))} ago`
            : "Identity not confirmed yet"}
        </span>
        {d.job?.status === "failed" && d.job.error && (
          <span className="text-critical-text text-xs">{d.job.error}</span>
        )}
      </section>
      <ProposalsPanel accountId={accountId} d={d} />
      <ProfileFields accountId={accountId} d={d} />
      <div className="grid gap-4 lg:grid-cols-2">
        <FinancialSnapshot d={d} />
        <HierarchyTree name={accountName} d={d} />
      </div>
      <HiringTrend d={d} />
      <ManualPrompts accountId={accountId} d={d} />
      <section className="bg-card rounded-lg border p-4" aria-labelledby="src-runs-h">
        <h2 id="src-runs-h" className="mb-2 text-sm font-semibold">
          Public sources for this account
        </h2>
        <ul className="grid gap-1.5 text-[13px] md:grid-cols-2">
          {d.enrichers
            .filter((e) => e.enabled || e.lastRun)
            .map((e) => {
              const r = e.lastRun;
              const Icon = e.blocked
                ? CircleSlash
                : !r
                  ? Clock
                  : !r.ok
                    ? AlertCircle
                    : CheckCircle2;
              return (
                <li key={e.id} className="flex items-start gap-2">
                  <Icon
                    className={`mt-0.5 size-3.5 shrink-0 ${e.blocked ? "text-muted-foreground" : r && !r.ok ? "text-critical-text" : r ? "text-good-text" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <span className="font-medium">{e.label}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {e.blocked ??
                        (r?.finishedAt
                          ? `${r.ok ? "ran" : "failed"} ${formatDistanceToNowStrict(new Date(r.finishedAt))} ago · refreshes every ${e.ttlDays}d`
                          : "not run yet")}
                    </span>
                    {r && !r.ok && r.error && (
                      <p className="text-critical-text text-xs break-words">{r.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
