import "server-only";
import * as echarts from "echarts";
import type { ChartSpec, ValueFormat } from "./types";

/** Print palette = the light-mode dataviz tokens (exports are always rendered light). */
const P = {
  ink: "#121211",
  ink2: "#52514e",
  muted: "#898781",
  grid: "#e9e8e2",
  axis: "#c3c2b7",
  surface: "#ffffff",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
};

export function formatValue(v: number, f: ValueFormat = "number"): string {
  if (f === "currency")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: Math.abs(v) >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(v);
  if (f === "percent") return `${Math.round(v * 100)}%`;
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(v) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(v);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * Server-side ECharts → SVG string. Vector output = crisp at any print resolution.
 * Labels are escaped before handing to ECharts so user-entered names can't inject markup.
 */
export function renderChartSvg(spec: ChartSpec, width = 760, height = 300): string {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  const fmt = (v: number) => formatValue(v, spec.valueFormat);
  const horizontal = spec.type === "hbar";
  const multi = spec.series.length > 1;
  const cats = spec.categories.map(esc);
  const valueAxis = {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: P.grid } },
    axisLabel: { color: P.muted, fontSize: 11, formatter: fmt },
  };
  const catAxis = {
    type: "category" as const,
    data: cats,
    axisLine: { lineStyle: { color: P.axis } },
    axisTick: { show: false },
    axisLabel: { color: P.ink2, fontSize: 11, interval: 0 },
    inverse: horizontal,
  };
  chart.setOption({
    animation: false,
    backgroundColor: P.surface,
    textStyle: { fontFamily: "Inter, Helvetica, Arial, sans-serif", color: P.ink2 },
    grid: {
      left: 8,
      right: horizontal ? 64 : 16,
      top: multi ? 36 : 16,
      bottom: 8,
      containLabel: true,
    },
    legend: multi
      ? {
          top: 0,
          left: 0,
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: P.ink2, fontSize: 11 },
        }
      : { show: false },
    xAxis: horizontal
      ? { ...valueAxis, splitLine: { show: false }, axisLabel: { show: false } }
      : catAxis,
    yAxis: horizontal ? catAxis : valueAxis,
    series: spec.series.map((s, i) => ({
      name: esc(s.name),
      type: spec.type === "line" ? "line" : "bar",
      stack: spec.type === "stacked" ? "total" : undefined,
      barMaxWidth: 24,
      data: s.values,
      itemStyle: {
        color: P.series[i % P.series.length],
        borderRadius: spec.type === "stacked" ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      lineStyle: { width: 2 },
      label:
        !multi && spec.type !== "line"
          ? {
              show: true,
              position: horizontal ? "right" : "top",
              color: P.ink2,
              fontSize: 10,
              formatter: (p: { value?: unknown }) => fmt(Number(p.value)),
            }
          : undefined,
      markLine:
        i === 0 && spec.reference
          ? {
              symbol: "none",
              silent: true,
              lineStyle: { color: P.ink2, type: "solid", width: 1.5 },
              label: {
                formatter: esc(spec.reference.label),
                color: P.ink2,
                fontSize: 10,
                position: "insideStartTop",
              },
              data: [{ yAxis: spec.reference.value }],
            }
          : undefined,
    })),
  });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}
