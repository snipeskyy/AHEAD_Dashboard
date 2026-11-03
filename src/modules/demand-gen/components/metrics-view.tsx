"use client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Chart, barStyle, baseOption, categoryAxis, valueAxis } from "@/components/chart";
import { StatTile } from "@/components/kpi/stat-tile";
import { CardSkeleton } from "@/components/states";
import { BUYING_ROLE_LABELS, type BuyingRole } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { formatPercent } from "@/lib/format";
import { ChartCard } from "@/modules/opportunities/components/analytics-view";

interface Metrics {
  totals: {
    completed90: number;
    planned30: number;
    replyRate: number;
    meetingRate: number;
    oppsCreated: number;
    accountsTouched: number;
  };
  weekly: Array<{ week: string; touches: number; meetings: number }>;
  channels: Array<{ channel: string; touches: number; replyRate: number; meetingRate: number }>;
  personaCoverage: Array<{ role: string; identified: number; engaged: number }>;
  topAccounts: Array<{ accountId: string; name: string; tier: string; touches: number }>;
  coldStrategic: Array<{ accountId: string; name: string; lastTouchAt: string | null }>;
  plays: Array<{
    playId: string;
    name: string;
    campaigns: number;
    touches: number;
    replies: number;
    meetings: number;
    opps: number;
  }>;
}

export function MetricsView() {
  const { data: m, isLoading } = useQuery({
    queryKey: ["dg-metrics"],
    queryFn: () => api<Metrics>("/api/demand-gen/metrics"),
  });
  if (isLoading || !m) return <CardSkeleton lines={10} />;
  const t = m.totals;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Touches (90 days)" value={t.completed90} />
        <StatTile label="Planned (next 30 days)" value={t.planned30} />
        <StatTile label="Reply rate" value={formatPercent(t.replyRate)} />
        <StatTile label="Meeting rate" value={formatPercent(t.meetingRate)} />
        <StatTile label="Opps from outreach" value={t.oppsCreated} />
        <StatTile
          label="Accounts touched"
          value={t.accountsTouched}
          sub={`${m.coldStrategic.length} strategic accounts cold 45d+`}
          tone={m.coldStrategic.length ? "warning" : "good"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Weekly touch volume"
          description="Completed touches per week, last 12 weeks"
        >
          <Chart
            label="Weekly touch volume"
            height={220}
            table={{
              columns: ["Week of", "Touches", "Meetings"],
              rows: m.weekly.map((w) => [format(parseISO(w.week), "MMM d"), w.touches, w.meetings]),
            }}
            option={(th) => ({
              ...baseOption(th),
              tooltip: { ...baseOption(th).tooltip, trigger: "axis" },
              xAxis: categoryAxis(
                th,
                m.weekly.map((w, i) =>
                  i === m.weekly.length - 1
                    ? `${format(parseISO(w.week), "MMM d")} (WTD)`
                    : format(parseISO(w.week), "MMM d"),
                ),
              ),
              yAxis: valueAxis(th),
              series: [
                {
                  type: "bar",
                  ...barStyle(),
                  name: "Touches",
                  itemStyle: { color: th.series[0], borderRadius: [4, 4, 0, 0] },
                  data: m.weekly.map((w) => w.touches),
                },
              ],
            })}
          />
        </ChartCard>
        <ChartCard
          title="Persona coverage"
          description="Share of Strategic + Growth accounts with each buying role identified / engaged"
        >
          <Chart
            label="Persona coverage by buying role"
            height={220}
            table={{
              columns: ["Role", "Identified", "Engaged"],
              rows: m.personaCoverage.map((p) => [
                BUYING_ROLE_LABELS[p.role as BuyingRole] ?? p.role,
                formatPercent(p.identified),
                formatPercent(p.engaged),
              ]),
            }}
            option={(th) => ({
              ...baseOption(th),
              grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
              legend: { ...baseOption(th).legend, show: true, top: 0, left: 0 },
              tooltip: {
                ...baseOption(th).tooltip,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                valueFormatter: (v: unknown) => formatPercent(Number(v)),
              },
              xAxis: categoryAxis(
                th,
                m.personaCoverage.map((p) => BUYING_ROLE_LABELS[p.role as BuyingRole] ?? p.role),
                { axisLabel: { color: th.muted, fontSize: 11, interval: 0 } },
              ),
              yAxis: { ...valueAxis(th, (v: number) => formatPercent(v)), max: 1 },
              series: [
                {
                  type: "bar",
                  name: "Identified",
                  ...barStyle(),
                  itemStyle: { color: th.seq.s250, borderRadius: [4, 4, 0, 0] },
                  data: m.personaCoverage.map((p) => p.identified),
                },
                {
                  type: "bar",
                  name: "Engaged",
                  ...barStyle(),
                  itemStyle: { color: th.seq.s550, borderRadius: [4, 4, 0, 0] },
                  data: m.personaCoverage.map((p) => p.engaged),
                },
              ],
            })}
          />
        </ChartCard>
      </div>
      <section className="bg-card overflow-x-auto rounded-lg border">
        <header className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold">Play effectiveness</h2>
          <p className="text-muted-foreground text-xs">
            Completed touches → replies → meetings → opportunities
          </p>
        </header>
        <table className="w-full text-[13px]">
          <caption className="sr-only">Play effectiveness funnel</caption>
          <thead className="text-muted-foreground text-xs">
            <tr className="border-y">
              {[
                "Play",
                "Campaigns",
                "Touches",
                "Replies",
                "Meetings",
                "Opps",
                "Touch → meeting",
              ].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.plays.map((p) => (
              <tr key={p.playId} className="border-b last:border-0">
                <td className="px-4 py-2">{p.name}</td>
                {[p.campaigns, p.touches, p.replies, p.meetings, p.opps].map((v, i) => (
                  <td key={i} className="tabular px-4 py-2 text-right">
                    {v}
                  </td>
                ))}
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
                      <span
                        className="bg-chart-1 block h-full"
                        style={{ width: `${p.touches ? (p.meetings / p.touches) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="tabular w-9">
                      {p.touches ? formatPercent(p.meetings / p.touches) : "—"}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-card rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Touches per account (90 days)</h2>
          <ul className="grid gap-1.5">
            {m.topAccounts.map((a) => (
              <li key={a.accountId} className="flex items-center gap-3 text-[13px]">
                <Link href={`/accounts/${a.accountId}`} className="w-48 truncate hover:underline">
                  {a.name}
                </Link>
                <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <span
                    className="bg-chart-1 block h-full rounded-full"
                    style={{ width: `${(a.touches / (m.topAccounts[0]?.touches || 1)) * 100}%` }}
                  />
                </span>
                <span className="tabular w-6 text-right">{a.touches}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="bg-card rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-semibold">Channel mix</h2>
          <table className="w-full text-[13px]">
            <caption className="sr-only">Channel performance</caption>
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b">
                <th scope="col" className="py-1.5 text-left font-medium">
                  Channel
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Touches
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Reply
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Meeting
                </th>
              </tr>
            </thead>
            <tbody>
              {m.channels.map((c) => (
                <tr key={c.channel} className="border-b last:border-0">
                  <td className="py-1.5 capitalize">{c.channel}</td>
                  <td className="tabular py-1.5 text-right">{c.touches}</td>
                  <td className="tabular py-1.5 text-right">{formatPercent(c.replyRate)}</td>
                  <td className="tabular py-1.5 text-right">{formatPercent(c.meetingRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.coldStrategic.length > 0 && (
            <div className="mt-4">
              <h3 className="text-warning-text mb-1 text-xs font-semibold">
                Strategic accounts with no touch in 45+ days
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {m.coldStrategic.map((a) => (
                  <li key={a.accountId}>
                    <Link
                      href={`/accounts/${a.accountId}`}
                      className="hover:bg-muted rounded border px-1.5 py-0.5 text-xs"
                    >
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
