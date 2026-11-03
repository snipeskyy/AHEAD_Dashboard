"use client";
import type { EChartsOption } from "echarts";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { Table2, ChartColumn } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { readChartTheme, type ChartTheme } from "./theme";

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  MarkLineComponent,
  VisualMapComponent,
  SVGRenderer,
]);

export interface ChartTableData {
  columns: string[];
  rows: Array<Array<string | number>>;
}

/** Set by WidgetFrame: charts inside widgets must keep the grid-provided height. */
export const ChartFixedHeightContext = createContext(false);

export interface ChartProps {
  /** Accessible name — describes what the chart shows. */
  label: string;
  option: (t: ChartTheme) => EChartsOption;
  /** Every chart has a table twin (WCAG alternative + exact values). */
  table: ChartTableData;
  height?: number;
  className?: string;
  onClick?: (params: {
    name: string;
    seriesName?: string;
    data: unknown;
    dataIndex: number;
  }) => void;
  /** Optional slot rendered next to the table toggle. */
  toolbar?: ReactNode;
  hideToggle?: boolean;
}

/** The single chart entry point. All charts in ACC render through this wrapper. */
export function Chart({
  label,
  option,
  table,
  height = 240,
  className,
  onClick,
  toolbar,
  hideToggle,
}: ChartProps) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const presenting = useUiStore((st) => st.presentationMode);
  // Inside a dashboard widget the height is fixed by the grid; elsewhere, Presentation Mode enlarges charts.
  const fixed = useContext(ChartFixedHeightContext);
  if (presenting && !fixed) height = Math.round(height * 1.3);
  const [view, setView] = useState<"chart" | "table">("chart");
  // Re-read CSS tokens whenever the theme or accent changes.
  const opt = useMemo(
    () => (mounted ? option(readChartTheme(resolvedTheme, presenting)) : null),
    [mounted, option, resolvedTheme, presenting],
  );

  return (
    <div className={cn("relative", className)}>
      {!hideToggle && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1" data-print-hide="true">
          {toolbar}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={view === "chart" ? `Show ${label} as table` : `Show ${label} as chart`}
            onClick={() => setView(view === "chart" ? "table" : "chart")}
          >
            {view === "chart" ? <Table2 /> : <ChartColumn />}
          </Button>
        </div>
      )}
      {view === "table" ? (
        <ChartTable label={label} table={table} height={height} />
      ) : (
        <div role="img" aria-label={label} style={{ height }} className="w-full">
          {opt && (
            <ReactEChartsCore
              echarts={echarts}
              option={opt}
              notMerge
              opts={{ renderer: "svg" }}
              style={{ height: "100%", width: "100%" }}
              onEvents={onClick ? { click: onClick } : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ChartTable({
  label,
  table,
  height,
}: {
  label: string;
  table: ChartTableData;
  height: number;
}) {
  return (
    <div className="overflow-auto" style={{ maxHeight: height }}>
      <table className="w-full text-xs">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-card sticky top-0">
          <tr>
            {table.columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  "text-muted-foreground border-b px-2 py-1.5 font-medium",
                  i === 0 ? "text-left" : "text-right",
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn("px-2 py-1.5", ci === 0 ? "text-left" : "tabular text-right")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
