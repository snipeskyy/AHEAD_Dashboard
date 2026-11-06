import type { ChartSpec, ValueFormat } from "@/lib/export/types";

/**
 * Template-only "so what" lines. Every sentence is computed from the numbers on the slide; nothing is
 * invented and no AI is involved. Returns null when there's nothing honest to say.
 */
export function fmtValue(v: number, f?: ValueFormat) {
  if (f === "currency")
    return Math.abs(v) >= 1e6
      ? `$${(v / 1e6).toFixed(1)}M`
      : Math.abs(v) >= 1e3
        ? `$${Math.round(v / 1e3)}K`
        : `$${Math.round(v)}`;
  if (f === "percent") return `${Math.round(v)}%`;
  return Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v * 10) / 10}`;
}

const change = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 100));

export function chartTakeaway(spec: ChartSpec): string | null {
  const cats = spec.categories;
  if (!cats.length || !spec.series.length) return null;
  const totals = cats.map((_, i) => spec.series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  const sum = totals.reduce((s, v) => s + v, 0);
  if (sum === 0) return null;
  const f = spec.valueFormat;

  if (spec.type === "line" && cats.length >= 2) {
    const first = totals[0];
    const last = totals[totals.length - 1];
    const ch = change(last, first);
    const what = spec.series.length === 1 ? spec.series[0].name : "The total";
    const from = cats[0];
    const to = cats[cats.length - 1];
    if (ch === null) return `${what} reached ${fmtValue(last, f)} in ${to}.`;
    if (ch === 0) return `${what} was flat from ${from} to ${to} (${fmtValue(last, f)}).`;
    return `${what} ${ch > 0 ? "rose" : "fell"} ${Math.abs(ch)}% from ${from} to ${to} (${fmtValue(first, f)} → ${fmtValue(last, f)}).`;
  }
  if (spec.reference) {
    const ref = spec.reference;
    const above = totals.filter((v) => v >= ref.value).length;
    const noun = cats.length === 1 ? "period is" : "periods are";
    return `${above} of ${cats.length} ${noun} at or above ${ref.label.toLowerCase()} (${fmtValue(ref.value, f)}).`;
  }
  if (cats.length === 1) return `${cats[0]}: ${fmtValue(totals[0], f)}.`;
  const top = totals.indexOf(Math.max(...totals));
  const share = Math.round((totals[top] / sum) * 100);
  return `${cats[top]} leads with ${fmtValue(totals[top], f)} (${share}% of ${fmtValue(sum, f)} total).`;
}

/** Speaker-note line for a KPI slide: the values, so the presenter can read them out. */
export function kpiNotes(items: Array<{ label: string; value: string }>) {
  return items
    .slice(0, 8)
    .map((i) => `${i.label}: ${i.value}`)
    .join(". ")
    .concat(".");
}
