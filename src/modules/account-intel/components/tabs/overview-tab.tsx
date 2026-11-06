"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { CalendarClock, History } from "lucide-react";
import Link from "next/link";
import { InlineSelect, InlineText } from "@/components/data-table";
import { StatTile } from "@/components/kpi/stat-tile";
import { practiceLabel } from "@/config/practice-areas";
import { TIERS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { formatCurrencyCompact } from "@/lib/format";
import type { Account360 } from "../../hooks/use-accounts";
import { useAccountMutation } from "../../hooks/use-accounts";
import { SourceTag } from "../evidence-link";
import { ScoreBreakdown } from "../score-breakdown";
import { PartnerPanel } from "../partner-panel";

const rel = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

export function OverviewTab({ d }: { d: Account360 }) {
  const a = d.account;
  const patch = useAccountMutation(
    a.id,
    (body: Record<string, unknown>) =>
      api(`/api/accounts/${a.id}`, { method: "PATCH", json: body }),
    "Saved",
  );
  const field = (label: string, node: React.ReactNode, internal = false) => (
    <div
      className="grid grid-cols-[110px_1fr] items-center gap-2 py-1"
      data-internal-only={internal ? "true" : undefined}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="min-w-0 text-[13px]">{node}</div>
    </div>
  );
  const gaps = d.whitespace.components
    .filter((c) => c.score > 0.4)
    .sort((x, y) => y.contribution - x.contribution)
    .slice(0, 4);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open pipeline"
          value={formatCurrencyCompact(d.opps.openAmount)}
          sub={`${d.opps.openCount} open opps · ${formatCurrencyCompact(d.opps.weighted)} weighted`}
          internal
        />
        <StatTile label="Won (all time)" value={formatCurrencyCompact(d.opps.wonAmount)} internal />
        <StatTile
          label="Last touch"
          value={d.touches.last ? rel(d.touches.last.at) : "Never"}
          sub={
            d.touches.last
              ? `${d.touches.last.channel} · ${d.touches.last.persona}`
              : "No completed touches"
          }
        />
        <StatTile
          label="Next touch"
          value={d.touches.next ? rel(d.touches.next.at) : "None planned"}
          sub={
            d.touches.next
              ? `${d.touches.next.channel} · ${d.touches.next.persona}`
              : "Plan one in Demand Gen"
          }
          tone={d.touches.next ? undefined : "warning"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="bg-card rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Firmographics</h2>
          <div className="divide-y">
            {field(
              "Tier",
              <InlineSelect
                label="Tier"
                value={a.tier}
                options={TIERS.map((t) => ({ value: t, label: t }))}
                onCommit={(v) => patch.mutate({ tier: v })}
              />,
              true,
            )}
            {field(
              "Industry",
              <InlineText
                label="Industry"
                value={a.industry}
                onCommit={(v) => patch.mutate({ industry: v })}
              />,
            )}
            {field(
              "Sub-industry",
              <InlineText
                label="Sub-industry"
                value={a.subIndustry ?? ""}
                onCommit={(v) => patch.mutate({ subIndustry: v || null })}
              />,
            )}
            {field(
              "HQ",
              <InlineText
                label="Headquarters"
                value={a.hq ?? ""}
                onCommit={(v) => patch.mutate({ hq: v || null })}
              />,
            )}
            {field(
              "Employees",
              <InlineText
                label="Employee band"
                value={a.employeeBand ?? ""}
                onCommit={(v) => patch.mutate({ employeeBand: v || null })}
              />,
            )}
            {field(
              "Revenue",
              <InlineText
                label="Revenue band"
                value={a.revenueBand ?? ""}
                onCommit={(v) => patch.mutate({ revenueBand: v || null })}
              />,
            )}
            {field(
              "Domain",
              <InlineText
                label="Domain"
                value={a.domain ?? ""}
                onCommit={(v) => patch.mutate({ domain: v || null })}
              />,
            )}
            {field(
              "Ticker",
              <InlineText
                label="Ticker"
                value={a.ticker ?? ""}
                placeholder="—"
                onCommit={(v) => patch.mutate({ ticker: v || null })}
              />,
            )}
          </div>
        </section>
        <ScoreBreakdown
          title="Health score"
          score={d.health}
          tone="status"
          settingsHref="/settings?tab=scoring"
        />
        <ScoreBreakdown
          title="Whitespace score"
          score={{
            ...d.whitespace,
            components: d.whitespace.components
              .filter((c) => c.contribution > 0)
              .sort((x, y) => y.contribution - x.contribution),
          }}
          tone="neutral"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="bg-card rounded-lg border p-4 lg:col-span-2">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Key initiatives</h2>
            <Link href="?tab=intelligence" className="text-primary text-xs hover:underline">
              All intelligence
            </Link>
          </header>
          {d.initiatives.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">
              No initiatives yet.{" "}
              {a.isDemo
                ? ""
                : "They'll appear from public sources, or add one as a hypothesis in Intelligence."}
            </p>
          ) : (
            <ul className="divide-y">
              {d.initiatives.slice(0, 4).map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{i.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {i.practiceAreas.map((p) => practiceLabel(p)).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="tabular text-xs" data-internal-only="true">
                      {Math.round(i.confidence * 100)}% conf.
                    </span>
                    <SourceTag source={i.source} url={i.sourceUrl} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {gaps.length > 0 && (
            <div className="mt-3 border-t pt-3" data-internal-only="true">
              <div className="text-muted-foreground mb-1.5 text-xs font-medium">
                Biggest whitespace
              </div>
              <div className="flex flex-wrap gap-1.5">
                {gaps.map((g) => (
                  <Link
                    key={g.id}
                    href="?tab=whitespace"
                    className="hover:bg-muted rounded-md border px-2 py-0.5 text-xs"
                  >
                    {g.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="bg-card rounded-lg border p-4" data-internal-only="true">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <History className="text-muted-foreground size-4" /> Owner notes
          </h2>
          <textarea
            key={a.ownerNotes ?? ""}
            aria-label="Owner notes"
            defaultValue={a.ownerNotes ?? ""}
            onBlur={(e) =>
              e.target.value !== (a.ownerNotes ?? "") &&
              patch.mutate({ ownerNotes: e.target.value || null })
            }
            rows={6}
            placeholder="Relationship context, preferences, history…"
            className="bg-muted/40 focus:border-ring focus:bg-background w-full resize-y rounded-md border border-transparent p-2 text-[13px] outline-none"
          />
          {d.opps.nextClose && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
              <CalendarClock className="size-3.5" /> Next close date {rel(d.opps.nextClose)}
            </p>
          )}
        </section>
      </div>
      <PartnerPanel accountId={d.account.id} />
    </div>
  );
}
