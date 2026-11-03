"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chart, baseOption } from "@/components/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { TIERS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import type { WidgetProps } from "@/modules/types";

interface Matrix {
  dimensions: Array<{ id: string; label: string }>;
  rows: Array<{
    id: string;
    name: string;
    tier: string;
    health: number;
    dims: Array<{ id: string; score: number; input: string }>;
  }>;
}

const SHORT: Record<string, string> = {
  engagement: "Engagement",
  coverage: "Coverage",
  momentum: "Momentum",
  signals: "Signals",
  quality: "MEDDPICC",
  risk: "Risk (inv.)",
};

/** Accounts × health dimensions. Sequential single-hue ramp; lowest-health accounts first. */
export default function HealthHeatmapWidget({ height }: WidgetProps) {
  const [tier, setTier] = useState<string>("Strategic");
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "health-matrix", tier],
    queryFn: () => api<Matrix>(`/api/dashboard/health-matrix?tier=${tier}`),
  });
  const toolbar = (
    <select
      aria-label="Tier"
      value={tier}
      onChange={(e) => setTier(e.target.value)}
      className="border-input dark:bg-input/30 h-6 rounded border bg-transparent px-1.5 text-xs"
    >
      {TIERS.map((t) => (
        <option key={t}>{t}</option>
      ))}
    </select>
  );
  if (isLoading || !data) return <Skeleton style={{ height }} />;
  const rows = data.rows;
  const dims = data.dimensions.map((d) => SHORT[d.id] ?? d.label);
  const rowH = 22;
  const chartH = Math.max(height - 8, rows.length * rowH + 48);
  return (
    <div className="overflow-y-auto pr-1" style={{ height }}>
      <Chart
        label={`Health dimensions for ${tier} accounts`}
        height={chartH}
        toolbar={toolbar}
        onClick={(p) =>
          rows[(p.data as number[])[1]] &&
          router.push(`/accounts/${rows[(p.data as number[])[1]].id}`)
        }
        table={{
          columns: ["Account", "Health", ...dims],
          rows: rows.map((r) => [
            r.name,
            Math.round(r.health),
            ...r.dims.map((d) => `${Math.round(d.score * 100)}%`),
          ]),
        }}
        option={(t) => ({
          ...baseOption(t),
          grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
          tooltip: {
            ...baseOption(t).tooltip,
            trigger: "item",
            formatter: (p: unknown) => {
              const [x, y] = (p as { data: number[] }).data;
              const r = rows[y];
              return `<b>${r.name}</b><br/>${dims[x]}: ${Math.round(r.dims[x].score * 100)}%<br/><span style="color:${t.muted}">${r.dims[x].input}</span>`;
            },
          },
          xAxis: {
            type: "category",
            data: dims,
            position: "top",
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: t.muted, fontSize: 11, interval: 0 },
            splitArea: { show: false },
          },
          yAxis: {
            type: "category",
            data: rows.map((r) => `${r.name}  ${Math.round(r.health)}`),
            inverse: true,
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: t.ink2, fontSize: 11 },
          },
          visualMap: {
            min: 0,
            max: 1,
            show: false,
            inRange: { color: [t.seq.s100, t.seq.s250, t.seq.s400, t.seq.s550, t.seq.s700] },
          },
          series: [
            {
              type: "heatmap",
              data: rows.flatMap((r, y) =>
                r.dims.map((d, x) => [x, y, Number(d.score.toFixed(2))]),
              ),
              itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
              emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
            },
          ],
        })}
      />
    </div>
  );
}
