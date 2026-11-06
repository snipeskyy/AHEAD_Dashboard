"use client";
import { ExternalLink } from "lucide-react";
import { Chart, baseOption, type ChartTheme } from "@/components/chart";
import { displayValue, formatMoney } from "@/lib/enrich/fields";
import type { AccountEnrichment } from "../../hooks/use-enrichment";

const METRICS = [
  { id: "revenue", label: "Revenue", series: 0 },
  { id: "netIncome", label: "Net income", series: 1 },
  { id: "capex", label: "Capex", series: 2 },
] as const;

function Sparkline({
  label,
  points,
  color,
}: {
  label: string;
  points: Array<{ year: number; value: number }>;
  color: (t: ChartTheme) => string;
}) {
  return (
    <Chart
      label={`${label} by fiscal year`}
      height={64}
      table={{
        columns: ["Fiscal year", label],
        rows: points.map((p) => [String(p.year), formatMoney(p.value)]),
      }}
      option={(t) => ({
        ...baseOption(t),
        grid: { left: 2, right: 2, top: 6, bottom: 2 },
        legend: { show: false },
        tooltip: {
          ...baseOption(t).tooltip,
          trigger: "axis",
          valueFormatter: (v: unknown) => formatMoney(Number(v)),
        },
        xAxis: {
          type: "category",
          data: points.map((p) => `FY${String(p.year).slice(2)}`),
          show: false,
        },
        yAxis: { type: "value", show: false, scale: true },
        series: [
          {
            type: "line",
            data: points.map((p) => p.value),
            smooth: false,
            symbol: "circle",
            symbolSize: 8,
            lineStyle: { width: 2, color: color(t) },
            itemStyle: { color: color(t), borderColor: t.surface, borderWidth: 2 },
          },
        ],
      })}
    />
  );
}

/** Public-company financials from SEC XBRL (10-K annual values) with 5-year sparklines and fiscal year end. */
export function FinancialSnapshot({ d }: { d: AccountEnrichment }) {
  const fye = d.fields.find((f) => f.field === "financials.fiscalYearEnd");
  if (!d.financials.length && !fye) return null;
  return (
    <section className="bg-card grid gap-3 rounded-lg border p-4" aria-labelledby="fin-h">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fin-h" className="text-sm font-semibold">
          Financial snapshot
        </h2>
        {fye && (
          <span className="text-muted-foreground text-xs">
            Fiscal year ends {displayValue("financials.fiscalYearEnd", fye.value)}
          </span>
        )}
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {METRICS.map((m) => {
          const rows = d.financials
            .filter((f) => f.metric === m.id)
            .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
          if (!rows.length)
            return (
              <div key={m.id} className="text-muted-foreground text-xs">
                {m.label}: not reported
              </div>
            );
          const last = rows.at(-1)!;
          const prev = rows.at(-2);
          const yoy = prev && prev.value ? (last.value - prev.value) / Math.abs(prev.value) : null;
          return (
            <div key={m.id} className="grid gap-1">
              <div className="text-muted-foreground text-xs">
                {m.label} · FY{last.fiscalYear}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums">
                  {formatMoney(last.value)}
                </span>
                {yoy !== null && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {yoy >= 0 ? "▲" : "▼"} {Math.abs(yoy * 100).toFixed(1)}% YoY
                  </span>
                )}
              </div>
              <Sparkline
                label={m.label}
                points={rows.map((r) => ({ year: r.fiscalYear, value: r.value }))}
                color={(t) => t.series[m.series]}
              />
              <a
                href={last.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                SEC 10-K <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
