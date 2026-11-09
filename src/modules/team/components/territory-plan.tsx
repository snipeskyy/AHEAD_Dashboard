"use client";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { api } from "@/lib/api-client";
import { STAGE_LABELS, type Stage } from "@/lib/domain/enums";

interface Data {
  items: Array<{
    id: string;
    kind: string;
    text: string;
    owner: string | null;
    dueDate: string | null;
    status: string;
    overdue: boolean;
    account: { id: string; name: string; tier: string };
  }>;
  plans: Array<{
    opportunityId: string;
    title: string;
    opportunity: string;
    stage: string;
    account: { id: string; name: string };
    targetDate: string | null;
    health: "on-track" | "watch" | "off-track" | "empty";
    summary: string;
    next: { title: string; dueDate: string | null } | null;
  }>;
}

const HEALTH = {
  "on-track": { label: "✓ On track", cls: "text-good-text" },
  watch: { label: "⚠ Watch", cls: "text-warning-text" },
  "off-track": { label: "⚠ Off track", cls: "text-critical-text" },
  empty: { label: "No steps", cls: "text-muted-foreground" },
} as const;
const ORDER = { "off-track": 0, watch: 1, "on-track": 2, empty: 3 } as const;
const fmt = (d: string | null) =>
  d
    ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";

/** The shared territory plan: every mutual action plan with its health, then open account-plan items by account. */
export function TerritoryPlan() {
  const q = useQuery({
    queryKey: ["team-territory"],
    queryFn: () => api<Data>("/api/team-workspace/territory"),
  });
  const [all, setAll] = useState(false);
  if (q.isLoading) return <CardSkeleton lines={8} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const { items, plans } = q.data;
  if (!items.length && !plans.length)
    return (
      <EmptyState
        icon={MapIcon}
        title="No plans yet"
        description="Account plan objectives and actions (Account 360 → Plan) and mutual action plans (from an opportunity) appear here."
      />
    );
  const byAccount = new Map<string, Data["items"]>();
  for (const i of items) byAccount.set(i.account.id, [...(byAccount.get(i.account.id) ?? []), i]);
  // Accounts with the most overdue items first, then the soonest due item.
  const groups = [...byAccount.values()].sort(
    (a, b) =>
      b.filter((i) => i.overdue).length - a.filter((i) => i.overdue).length ||
      (a.find((i) => i.dueDate)?.dueDate ?? "9").localeCompare(
        b.find((i) => i.dueDate)?.dueDate ?? "9",
      ),
  );
  const shown = all ? groups : groups.slice(0, 12);
  return (
    <div className="grid gap-6">
      <section className="bg-card rounded-lg border" aria-label="Mutual action plans">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Mutual action plans</h2>
          <p className="text-muted-foreground text-xs">
            Off-track plans first. Health comes from overdue and at-risk steps and the target date.
          </p>
        </header>
        {plans.length === 0 ? (
          <p className="text-muted-foreground px-4 py-3 text-[13px]">
            No mutual action plans yet. Start one from an opportunity.
          </p>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Plan health" tabIndex={0}>
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="text-muted-foreground border-b text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Health</th>
                  <th className="px-4 py-2 font-medium">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...plans]
                  .sort((a, b) => ORDER[a.health] - ORDER[b.health])
                  .map((p) => (
                    <tr key={p.opportunityId}>
                      <td className="px-4 py-2">
                        <Link
                          className="font-medium hover:underline"
                          href={`/opportunities/${p.opportunityId}/plan`}
                        >
                          {p.title}
                        </Link>
                        <div className="text-muted-foreground text-xs">{p.summary}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Link className="hover:underline" href={`/accounts/${p.account.id}`}>
                          {p.account.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{STAGE_LABELS[p.stage as Stage] ?? p.stage}</td>
                      <td className="tabular px-4 py-2 whitespace-nowrap">{fmt(p.targetDate)}</td>
                      <td
                        className={`px-4 py-2 font-medium whitespace-nowrap ${HEALTH[p.health].cls}`}
                      >
                        {HEALTH[p.health].label}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {p.next ? `${p.next.title} · ${fmt(p.next.dueDate)}` : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="grid gap-3" aria-label="Account plans">
        <h2 className="text-sm font-semibold">Open account-plan items</h2>
        <p className="text-muted-foreground -mt-2 text-xs">Accounts with overdue items first.</p>
        {byAccount.size === 0 && (
          <p className="text-muted-foreground text-[13px]">No open account-plan items.</p>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((list) => (
            <div key={list[0].account.id} className="bg-card rounded-lg border">
              <header className="flex items-baseline gap-2 border-b px-4 py-2.5">
                <Link
                  className="text-[13px] font-semibold hover:underline"
                  href={`/accounts/${list[0].account.id}?tab=plan`}
                >
                  {list[0].account.name}
                </Link>
                <span className="text-muted-foreground text-xs">{list[0].account.tier}</span>
              </header>
              <ul className="divide-y">
                {list.slice(0, 8).map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-baseline gap-x-3 px-4 py-1.5 text-[13px]"
                  >
                    <span className="text-muted-foreground w-16 text-xs capitalize">{i.kind}</span>
                    <span className="min-w-0 flex-1">{i.text}</span>
                    {i.owner && <span className="text-muted-foreground text-xs">{i.owner}</span>}
                    <span
                      className={`tabular text-xs ${i.overdue ? "text-critical-text font-medium" : "text-muted-foreground"}`}
                    >
                      {i.overdue ? "⚠ " : ""}
                      {fmt(i.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {groups.length > shown.length && (
          <div>
            <Button size="sm" variant="outline" onClick={() => setAll(true)}>
              Show all {groups.length} accounts
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
