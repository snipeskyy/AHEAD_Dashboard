import "server-only";
import PptxGenJS from "pptxgenjs";
import type { Block, ChartSpec, ExportDocument } from "@/lib/export/types";
import type { DeckTheme, Slide } from "./types";

type S = PptxGenJS.Slide;
const W = 13.333;
const M = 0.6; // margin
const BODY_Y = 1.55;
const BODY_H = 5.3;

const fmt = (spec: ChartSpec) => (spec.valueFormat === "currency" ? "$#,##0" : spec.valueFormat === "percent" ? '0"%"' : "#,##0");

/**
 * Presentation-grade PPTX (Phase 10): a master with logo, footer and slide numbers, one renderer per
 * layout, native (editable) charts in the validated series palette, and speaker notes on every slide.
 */
export async function slidesToPptx(doc: ExportDocument, slides: Slide[], t: DeckTheme): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = doc.title;
  pptx.company = "";
  const footer = [
    t.footerNote,
    doc.audience === "customer" ? null : "Internal",
    doc.watermark || null,
    doc.dateStamp ? new Date(doc.generatedAt).toISOString().slice(0, 10) : null,
    `v${doc.version}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const logo = t.logo ? [{ image: { x: W - M - 1.6, y: 0.32, w: 1.6, h: 0.45, data: t.logo, sizing: { type: "contain" as const, w: 1.6, h: 0.45 } } }] : [];
  pptx.defineSlideMaster({
    title: "CONTENT",
    background: { color: t.surface },
    objects: [
      ...logo,
      { line: { x: M, y: 6.95, w: W - 2 * M, h: 0, line: { color: t.rule, width: 0.75 } } },
      { text: { text: footer, options: { x: M, y: 7.0, w: 10, h: 0.3, fontSize: 9, color: t.muted, fontFace: t.fontBody } } },
    ],
    slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 9, color: t.muted, align: "right" },
  });

  for (const s of slides) {
    const slide = pptx.addSlide({ masterName: s.layout === "title" || s.layout === "divider" ? undefined : "CONTENT" });
    RENDER[s.layout](pptx, slide, s, t, doc);
    if (doc.watermark && s.layout !== "title")
      slide.addText(doc.watermark, { x: 2.5, y: 3, w: 8.3, h: 1.4, fontSize: 54, bold: true, color: "D9D9D9", rotate: -18, align: "center", transparency: 70 });
    if (s.notes) slide.addNotes(s.notes);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

function header(slide: S, s: Slide, t: DeckTheme) {
  if (s.kicker) slide.addText(s.kicker.toUpperCase(), { x: M, y: 0.35, w: 9, h: 0.3, fontSize: 10, bold: true, color: t.primary, charSpacing: 1, fontFace: t.fontBody });
  slide.addText(s.title, { x: M, y: 0.62, w: 10.5, h: 0.7, fontSize: 26, bold: true, color: t.ink, fontFace: t.fontHead, fit: "shrink" });
  if (s.subtitle) slide.addText(s.subtitle, { x: M, y: 1.2, w: 10, h: 0.3, fontSize: 11, color: t.muted, fontFace: t.fontBody });
}

const listItems = (b: Block | undefined) => (b?.kind === "list" ? b.items : []);
const paragraphs = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.kind === "paragraph" ? [{ text: b.text }] : b.kind === "list" ? b.items : []));

function bulletText(items: Array<{ text: string; sub?: string }>, t: DeckTheme, size = 18) {
  return items.flatMap((i) => [
    { text: i.text, options: { bullet: { indent: 18 }, fontSize: size, color: t.ink, breakLine: true, paraSpaceBefore: 8 } },
    ...(i.sub ? [{ text: i.sub, options: { fontSize: size - 5, color: t.muted, indentLevel: 1, breakLine: true } }] : []),
  ]);
}

function chart(pptx: PptxGenJS, slide: S, spec: ChartSpec, t: DeckTheme, box: { x: number; y: number; w: number; h: number }) {
  const type = spec.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar;
  const data = spec.series.map((x) => ({ name: x.name, labels: spec.categories, values: x.values }));
  slide.addChart(type, data, {
    ...box,
    barDir: spec.type === "hbar" ? "bar" : "col",
    // First category on top, like the PDF (pptxgenjs types only list "minMax" but write "maxMin" too).
    catAxisOrientation: (spec.type === "hbar" ? "maxMin" : "minMax") as "minMax",
    barGrouping: spec.type === "stacked" ? "stacked" : "clustered",
    barGapWidthPct: 60,
    chartColors: t.series.slice(0, Math.max(1, spec.series.length)),
    lineSize: 2,
    lineDataSymbolSize: 7,
    showLegend: spec.series.length > 1,
    legendPos: "b",
    legendFontSize: 11,
    catAxisLabelFontSize: 11,
    valAxisLabelFontSize: 10,
    catAxisLabelColor: t.muted,
    valAxisLabelColor: t.muted,
    valAxisLabelFormatCode: fmt(spec),
    valGridLine: { color: t.rule, size: 0.5 },
    catGridLine: { style: "none" },
    showValue: spec.categories.length <= 8 && spec.series.length === 1,
    dataLabelFontSize: 10,
    dataLabelColor: t.ink,
    dataLabelFormatCode: fmt(spec),
  });
}

/** Column widths proportional to content (long text columns get room; numbers stay narrow). */
export function columnWidths(b: Extract<Block, { kind: "table" }>, total: number) {
  const weight = b.columns.map((c) => {
    const lens = b.rows.map((r) => (r[c.key]?.text ?? "").length);
    const avg = lens.length ? lens.reduce((s, n) => s + n, 0) / lens.length : 0;
    return Math.min(60, Math.max(6, c.label.length, avg));
  });
  const sum = weight.reduce((s, n) => s + n, 0);
  return weight.map((w) => (w / sum) * total);
}

type Renderer = (pptx: PptxGenJS, slide: S, s: Slide, t: DeckTheme, doc: ExportDocument) => void;

const RENDER: Record<Slide["layout"], Renderer> = {
  title(_p, slide, s, t) {
    slide.background = { color: t.surface };
    slide.addShape("rect", { x: 0, y: 0, w: 4.6, h: 7.5, fill: { color: t.primary } });
    if (t.logo) slide.addImage({ data: t.logo, x: 5.2, y: 0.6, w: 2.2, h: 0.6, sizing: { type: "contain", w: 2.2, h: 0.6 } });
    slide.addText(s.title, { x: 5.2, y: 2.3, w: 7.5, h: 1.8, fontSize: 36, bold: true, color: t.ink, fontFace: t.fontHead, valign: "bottom", fit: "shrink" });
    if (s.subtitle) slide.addText(s.subtitle, { x: 5.2, y: 4.2, w: 7.5, h: 0.5, fontSize: 16, color: t.muted, fontFace: t.fontBody });
    if (s.kicker) slide.addText(s.kicker, { x: 5.2, y: 6.4, w: 7.5, h: 0.4, fontSize: 12, color: t.muted, fontFace: t.fontBody });
  },
  agenda(_p, slide, s, t) {
    header(slide, s, t);
    listItems(s.blocks[0]).forEach((it, i) => {
      const y = BODY_Y + 0.15 + i * 0.62;
      slide.addShape("ellipse", { x: M, y, w: 0.45, h: 0.45, fill: { color: t.primary } });
      slide.addText(String(i + 1), { x: M, y, w: 0.45, h: 0.45, fontSize: 14, bold: true, color: t.onPrimary, align: "center", valign: "middle" });
      slide.addText(it.text, { x: M + 0.7, y, w: 10.5, h: 0.45, fontSize: 18, color: t.ink, valign: "middle", fontFace: t.fontBody });
    });
  },
  divider(_p, slide, s, t) {
    slide.background = { color: t.primary };
    slide.addText(s.title, { x: M + 0.4, y: 2.8, w: 11, h: 1.4, fontSize: 40, bold: true, color: t.onPrimary, fontFace: t.fontHead });
  },
  kpis(_p, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    const items = b?.kind === "kv" ? b.items : [];
    const cols = items.length <= 4 ? items.length : 4;
    const rows = Math.ceil(items.length / Math.max(1, cols));
    const gap = 0.3;
    const w = (W - 2 * M - gap * (cols - 1)) / Math.max(1, cols);
    const h = Math.min(2.1, (BODY_H - 0.4 - gap * (rows - 1)) / Math.max(1, rows));
    items.forEach((it, i) => {
      const x = M + (i % cols) * (w + gap);
      const y = BODY_Y + 0.3 + Math.floor(i / cols) * (h + gap);
      slide.addShape("roundRect", { x, y, w, h, fill: { color: t.soft }, line: { color: t.soft }, rectRadius: 0.08 });
      slide.addText(it.value, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: h * 0.55, fontSize: it.value.length > 16 ? 18 : it.value.length > 9 || !/\d/.test(it.value) ? 22 : 32, bold: true, color: t.ink, fontFace: t.fontHead, fit: "shrink", valign: "bottom" });
      slide.addText(it.label, { x: x + 0.25, y: y + h * 0.62, w: w - 0.5, h: 0.4, fontSize: 12, color: t.muted, fontFace: t.fontBody });
    });
  },
  facts(_p, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    const items = b?.kind === "kv" ? b.items : [];
    const half = Math.ceil(items.length / 2);
    [items.slice(0, half), items.slice(half)].forEach((col, c) =>
      slide.addTable(
        col.map((it) => [{ text: it.label, options: { color: t.muted, fontSize: 12 } }, { text: it.value, options: { color: t.ink, fontSize: 12, bold: true } }]),
        { x: M + c * 6.2, y: BODY_Y + 0.2, w: 5.8, colW: [2.2, 3.6], border: { type: "none" }, rowH: 0.42, fontFace: t.fontBody },
      ),
    );
  },
  chart(pptx, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    if (b?.kind === "chart") chart(pptx, slide, b.spec, t, { x: M, y: BODY_Y + 0.1, w: W - 2 * M, h: BODY_H - 0.2 });
  },
  "chart-takeaway"(pptx, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    if (b?.kind === "chart") chart(pptx, slide, b.spec, t, { x: M, y: BODY_Y + 0.1, w: 8, h: BODY_H - 0.2 });
    slide.addShape("rect", { x: 9.0, y: BODY_Y + 0.3, w: 0.06, h: 2.2, fill: { color: t.primary } });
    slide.addText(s.takeaway ?? "", { x: 9.25, y: BODY_Y + 0.25, w: 3.5, h: 2.4, fontSize: 18, bold: true, color: t.ink, fontFace: t.fontHead, valign: "top", fit: "shrink" });
  },
  table(_p, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    if (b?.kind !== "table") return;
    const head = b.columns.map((c) => ({ text: c.label, options: { bold: true, color: t.onPrimary, fill: { color: t.primary }, align: c.align ?? "left" } }));
    const rows = b.rows.map((r, i) =>
      b.columns.map((c) => ({ text: r[c.key]?.text ?? "", options: { color: t.ink, fill: { color: i % 2 ? t.soft : t.surface }, align: c.align ?? "left" } })),
    );
    slide.addTable([head, ...rows] as PptxGenJS.TableRow[], { x: M, y: BODY_Y + 0.15, w: W - 2 * M, colW: columnWidths(b, W - 2 * M), fontSize: 12, fontFace: t.fontBody, border: { type: "solid", color: t.rule, pt: 0.5 }, rowH: 0.42, autoPage: false });
    if (b.caption) slide.addText(b.caption, { x: M, y: 6.5, w: 10, h: 0.3, fontSize: 10, color: t.muted, italic: true });
  },
  bullets(_p, slide, s, t) {
    header(slide, s, t);
    slide.addText(bulletText(paragraphs(s.blocks), t), { x: M, y: BODY_Y + 0.1, w: W - 2 * M, h: BODY_H - 0.3, valign: "top", fontFace: t.fontBody, fit: "shrink" });
  },
  "two-column"(_p, slide, s, t) {
    header(slide, s, t);
    const items = paragraphs(s.blocks);
    const half = Math.ceil(items.length / 2);
    [items.slice(0, half), items.slice(half)].forEach((col, c) =>
      slide.addText(bulletText(col, t, 15), { x: M + c * 6.2, y: BODY_Y + 0.1, w: 5.9, h: BODY_H - 0.3, valign: "top", fontFace: t.fontBody, fit: "shrink" }),
    );
  },
  quote(_p, slide, s, t) {
    header(slide, s, t);
    const b = s.blocks[0];
    slide.addShape("rect", { x: M, y: 2.4, w: 0.1, h: 2.6, fill: { color: b?.kind === "callout" && b.tone === "warning" ? "EDA100" : t.primary } });
    slide.addText(b?.kind === "callout" ? b.text : "", { x: M + 0.4, y: 2.3, w: 11.2, h: 2.8, fontSize: 28, color: t.ink, fontFace: t.fontHead, valign: "middle", fit: "shrink" });
  },
  closing(_p, slide, s, t, doc) {
    slide.background = { color: t.soft };
    header(slide, { ...s, kicker: undefined }, t);
    const items = listItems(s.blocks[0]);
    if (items.length) slide.addText(bulletText(items, t), { x: M, y: BODY_Y + 0.1, w: W - 2 * M, h: 4.5, valign: "top", fit: "shrink" });
    else slide.addText("Questions and discussion", { x: M, y: 3.0, w: 11, h: 0.8, fontSize: 24, color: t.muted });
    if (doc.preparedBy) slide.addText(doc.preparedBy, { x: M, y: 6.4, w: 8, h: 0.4, fontSize: 14, bold: true, color: t.ink });
  },
};
