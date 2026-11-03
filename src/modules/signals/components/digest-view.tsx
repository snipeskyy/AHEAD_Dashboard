"use client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { Chart, barStyle, baseOption, categoryAxis, valueAxis } from "@/components/chart";
import { StatTile } from "@/components/kpi/stat-tile";
import { CardSkeleton } from "@/components/states";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { practiceLabel } from "@/config/practice-areas";
import { SIGNAL_TYPE_LABELS, type SignalType } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import type { SignalRow } from "../hooks/use-signals";
import type { SignalAction } from "./signal-row";

interface Digest {
  period: "day" | "week";
  since: string;
  total: number;
  high: number;
  activeAccounts: number;
  byType: Array<{ type: string; count: number }>;
  byPractice: Array<{ practice: string; count: number }>;
  accounts: Array<{
    accountId: string;
    name: string;
    tier: string;
    count: number;
    maxRelevance: number;
    top: SignalRow[];
  }>;
  top: SignalRow[];
}

/** Daily / weekly digest: a readable summary instead of a firehose. */
export function DigestView({ onAction }: { onAction: (a: SignalAction, s: SignalRow) => void }) {
  const [period, setPeriod] = useState<"day" | "week">("day");
  const { data: d, isLoading } = useQuery({
    queryKey: ["signals", "digest", period],
    queryFn: () => api<Digest>(`/api/signals/digest?period=${period}`),
  });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-[13px]">
          {d ? `Since ${format(new Date(d.since), "EEE MMM d, h:mm a")}` : " "}
        </p>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={period}
          onValueChange={(v) => v && setPeriod(v as "day" | "week")}
          aria-label="Digest period"
        >
          <ToggleGroupItem value="day">Daily</ToggleGroupItem>
          <ToggleGroupItem value="week">Weekly</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {isLoading || !d ? (
        <CardSkeleton lines={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Signals"
              value={d.total}
              sub={period === "day" ? "last 24 hours" : "last 7 days"}
            />
            <StatTile label="High relevance (≥ 60)" value={d.high} />
            <StatTile
              label="Accounts with activity"
              value={d.activeAccounts}
              sub={`top ${d.accounts.length} shown below`}
            />
            <StatTile
              label="Top practice"
              value={d.byPractice[0] ? practiceLabel(d.byPractice[0].practice, true) : "—"}
              sub={d.byPractice[0] ? `${d.byPractice[0].count} signals` : undefined}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section className="bg-card rounded-lg border p-4">
              <h2 className="mb-2 text-sm font-semibold">Signals by practice area</h2>
              <Chart
                label="Signals by practice area"
                height={260}
                table={{
                  columns: ["Practice", "Signals"],
                  rows: d.byPractice.map((p) => [practiceLabel(p.practice), p.count]),
                }}
                option={(t) => ({
                  ...baseOption(t),
                  grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
                  xAxis: {
                    ...valueAxis(t),
                    splitLine: { show: false },
                    axisLabel: { show: false },
                  },
                  yAxis: categoryAxis(
                    t,
                    d.byPractice.map((p) => practiceLabel(p.practice, true)),
                    { inverse: true, axisLine: { show: false } },
                  ),
                  series: [
                    {
                      type: "bar",
                      ...barStyle(true),
                      itemStyle: { color: t.series[0], borderRadius: [0, 4, 4, 0] },
                      data: d.byPractice.map((p) => p.count),
                      label: { show: true, position: "right", color: t.ink2, fontSize: 11 },
                    },
                  ],
                })}
              />
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-1.5 text-xs">
                {d.byType.map((t) => (
                  <span key={t.type} className="rounded border px-1.5 py-0.5">
                    {SIGNAL_TYPE_LABELS[t.type as SignalType] ?? t.type} {t.count}
                  </span>
                ))}
              </div>
            </section>
            <section className="bg-card rounded-lg border p-4">
              <h2 className="mb-2 text-sm font-semibold">Most important</h2>
              <ol className="grid gap-2">
                {d.top.map((s, i) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="text-muted-foreground tabular w-5 shrink-0 text-right text-xs">
                      {i + 1}.
                    </span>
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left text-[13px] font-medium hover:underline"
                        onClick={() => onAction("open", s)}
                      >
                        {s.title}
                      </button>
                      <div className="text-muted-foreground text-[11px]">
                        {s.accountName} · relevance {Math.round(s.relevance)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <section className="bg-card rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">By account</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {d.accounts.map((a) => (
                <div key={a.accountId} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/accounts/${a.accountId}?tab=signals`}
                      className="text-[13px] font-semibold hover:underline"
                    >
                      {a.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {a.count} signals · {a.tier}
                    </span>
                  </div>
                  <ul className="mt-2 grid gap-1">
                    {a.top.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="line-clamp-1 text-left text-xs hover:underline"
                          onClick={() => onAction("open", s)}
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
