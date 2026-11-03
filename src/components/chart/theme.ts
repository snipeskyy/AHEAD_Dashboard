"use client";
/**
 * Chart theme read from CSS custom properties (globals.css), so charts follow light/dark
 * and stay consistent with the rest of the UI. Series colors are the fixed, validated
 * dataviz palette — never the UI accent.
 */
export interface ChartTheme {
  mode: "light" | "dark";
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  series: string[];
  other: string;
  seq: { s100: string; s250: string; s400: string; s550: string; s700: string };
  status: { good: string; warning: string; serious: string; critical: string };
  font: string;
}

const FALLBACK: ChartTheme = {
  mode: "light",
  surface: "#ffffff",
  ink: "#121211",
  ink2: "#52514e",
  muted: "#898781",
  grid: "#e9e8e2",
  axis: "#c3c2b7",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  other: "#b4b2a9",
  seq: { s100: "#cde2fb", s250: "#86b6ef", s400: "#3987e5", s550: "#1c5cab", s700: "#0d366b" },
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
  font: "system-ui, sans-serif",
};

export function readChartTheme(themeHint?: string): ChartTheme {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    mode:
      (themeHint ?? (document.documentElement.classList.contains("dark") ? "dark" : "light")) ===
      "dark"
        ? "dark"
        : "light",
    surface: v("--chart-surface", FALLBACK.surface),
    ink: v("--chart-ink", FALLBACK.ink),
    ink2: v("--chart-ink-2", FALLBACK.ink2),
    muted: v("--chart-muted", FALLBACK.muted),
    grid: v("--chart-grid", FALLBACK.grid),
    axis: v("--chart-axis", FALLBACK.axis),
    series: FALLBACK.series.map((fb, i) => v(`--series-${i + 1}`, fb)),
    other: v("--series-other", FALLBACK.other),
    seq: {
      s100: v("--seq-100", FALLBACK.seq.s100),
      s250: v("--seq-250", FALLBACK.seq.s250),
      s400: v("--seq-400", FALLBACK.seq.s400),
      s550: v("--seq-550", FALLBACK.seq.s550),
      s700: v("--seq-700", FALLBACK.seq.s700),
    },
    status: {
      good: v("--status-good", FALLBACK.status.good),
      warning: v("--status-warning", FALLBACK.status.warning),
      serious: v("--status-serious", FALLBACK.status.serious),
      critical: v("--status-critical", FALLBACK.status.critical),
    },
    font: cs.getPropertyValue("font-family") || FALLBACK.font,
  };
}

/** Shared defaults: recessive hairline axes/grid, text tokens for all labels, consistent tooltip. */
export function baseOption(t: ChartTheme) {
  return {
    animationDuration: 300,
    textStyle: { fontFamily: t.font, color: t.ink2, fontSize: 11 },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.mode === "dark" ? "#1e1e1d" : "#ffffff",
      borderColor: t.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(11,11,11,0.10)",
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: t.ink, fontSize: 12, fontFamily: t.font },
      extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.12); border-radius: 6px;",
    },
    // Hidden by default: a single series needs no legend box. Multi-series charts opt in with show: true.
    legend: {
      show: false,
      textStyle: { color: t.ink2, fontSize: 11 },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
    },
  };
}

export function valueAxis(t: ChartTheme, formatter?: (v: number) => string) {
  return {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: t.grid, type: "solid" as const, width: 1 } },
    axisLabel: { color: t.muted, fontSize: 11, formatter },
  };
}

export function categoryAxis(t: ChartTheme, data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: "category" as const,
    data,
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
    ...extra,
  };
}

/** Ordinal ramp (ordered categories like funnel stages), light→dark, never below 2:1 near the surface. */
export function ordinalRamp(t: ChartTheme, n: number): string[] {
  const steps =
    t.mode === "dark"
      ? [t.seq.s250, t.seq.s400, t.seq.s550, t.seq.s700]
      : [t.seq.s250, t.seq.s400, t.seq.s550, t.seq.s700];
  if (n <= steps.length) return steps.slice(0, n);
  return Array.from(
    { length: n },
    (_, i) => steps[Math.min(steps.length - 1, Math.floor((i / n) * steps.length))],
  );
}

/** Bar style per dataviz spec: ≤24px, 4px rounded data-end, square at baseline. */
export const barStyle = (horizontal = false) => ({
  barMaxWidth: 24,
  itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
});
