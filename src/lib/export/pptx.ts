import "server-only";
import PptxGenJS from "pptxgenjs";
import type { Block, ExportDocument } from "./types";

const INK = "121211";
const MUTED = "5C5B57";
const ACCENT = "256ABF";
const SERIES = ["2A78D6", "EB6834", "1BAF7A", "EDA100", "E87BA4", "008300", "6250D6", "E34948"];

/**
 * Minimal PPTX: a title slide and one slide per section (native charts + tables; long content
 * continues on extra slides). Branded templates are a planned add-on.
 */
export async function documentToPptx(doc: ExportDocument): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = doc.title;

  const footer = [
    doc.scopeLabel,
    doc.dateStamp ? new Date(doc.generatedAt).toISOString().slice(0, 10) : null,
    `v${doc.version}`,
    doc.watermark || null,
    doc.isDemo ? "DEMO DATA" : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const decorate = (slide: PptxGenJS.Slide) => {
    slide.addText(footer, { x: 0.5, y: 7.05, w: 12.3, h: 0.3, fontSize: 9, color: MUTED });
    if (doc.watermark)
      slide.addText(doc.watermark, {
        x: 2,
        y: 2.8,
        w: 9.3,
        h: 1.6,
        fontSize: 60,
        bold: true,
        color: "D9D9D9",
        rotate: -20,
        align: "center",
        transparency: 60,
      });
  };

  const title = pptx.addSlide();
  title.background = { color: "FFFFFF" };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: ACCENT } });
  title.addText(doc.title, {
    x: 0.8,
    y: 2.4,
    w: 11.5,
    h: 1.2,
    fontSize: 36,
    bold: true,
    color: INK,
  });
  title.addText(`${doc.subtitle}  ·  ${doc.scopeLabel}`, {
    x: 0.8,
    y: 3.6,
    w: 11.5,
    h: 0.5,
    fontSize: 16,
    color: MUTED,
  });
  if (doc.preparedBy)
    title.addText(`Prepared by ${doc.preparedBy}`, {
      x: 0.8,
      y: 4.2,
      w: 11.5,
      h: 0.4,
      fontSize: 12,
      color: MUTED,
    });
  decorate(title);

  for (const s of doc.sections) {
    const cur = new Cursor(pptx, s.title, decorate);
    for (const b of s.blocks) addBlock(pptx, cur, b);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/** Tracks the current slide and vertical position; starts a continuation slide when content overflows. */
class Cursor {
  slide: PptxGenJS.Slide;
  y = 1.1;
  constructor(
    private pptx: PptxGenJS,
    private title: string,
    private decorate: (s: PptxGenJS.Slide) => void,
  ) {
    this.slide = this.newSlide(false);
  }
  private newSlide(cont: boolean) {
    const sl = this.pptx.addSlide();
    sl.addText(cont ? `${this.title} (cont.)` : this.title, {
      x: 0.5,
      y: 0.35,
      w: 12.3,
      h: 0.6,
      fontSize: 22,
      bold: true,
      color: INK,
    });
    this.decorate(sl);
    return sl;
  }
  /** Reserve `h` inches; returns the y to draw at. */
  place(h: number): number {
    if (this.y + h > 6.9 && this.y > 1.1) {
      this.slide = this.newSlide(true);
      this.y = 1.1;
    }
    const at = this.y;
    this.y += h + 0.15;
    return at;
  }
}

function addBlock(pptx: PptxGenJS, cur: Cursor, b: Block) {
  const text = (t: string, h: number, opts: PptxGenJS.TextPropsOptions = {}) => {
    const y = cur.place(h);
    cur.slide.addText(t, {
      x: 0.5,
      y,
      w: 12.3,
      h,
      fontSize: 12,
      color: INK,
      valign: "top",
      ...opts,
    });
  };
  switch (b.kind) {
    case "heading":
      return text(b.text, 0.45, { fontSize: 15, bold: true });
    case "paragraph":
    case "callout":
      return text(b.text, Math.min(1.6, 0.35 + Math.ceil(b.text.length / 140) * 0.25), {
        color: b.kind === "callout" ? MUTED : INK,
        italic: b.kind === "callout",
      });
    case "kv":
      return text(
        b.items.map((i) => `${i.label}: ${i.value}`).join("\n"),
        0.3 * b.items.length + 0.1,
      );
    case "list":
      return text(
        b.items
          .slice(0, 12)
          .map((i) => `• ${i.text}${i.sub ? ` — ${i.sub}` : ""}`)
          .join("\n"),
        Math.min(4.5, 0.32 * Math.min(12, b.items.length) + 0.1),
        { fontSize: 11 },
      );
    case "table": {
      if (!b.columns.length) return;
      // Paginate long tables: 12 rows per slide, header repeated.
      for (let i = 0; i < b.rows.length; i += 12) {
        const rows = b.rows.slice(i, i + 12);
        const y = cur.place(0.32 * (rows.length + 1) + 0.1);
        cur.slide.addTable(
          [
            b.columns.map((c) => ({
              text: c.label,
              options: { bold: true, color: MUTED, fill: { color: "F3F3F1" } },
            })),
            ...rows.map((r) =>
              b.columns.map((c) => ({
                text: r[c.key]?.text ?? "",
                options: { align: c.align === "right" ? ("right" as const) : ("left" as const) },
              })),
            ),
          ],
          {
            x: 0.5,
            y,
            w: 12.3,
            fontSize: 9,
            color: INK,
            border: { type: "solid", pt: 0.5, color: "E3E2DC" },
            autoPage: false,
          },
        );
      }
      return;
    }
    case "chart": {
      const y = cur.place(3.4);
      const fmt =
        b.spec.valueFormat === "currency"
          ? "$#,##0"
          : b.spec.valueFormat === "percent"
            ? "0%"
            : "#,##0";
      cur.slide.addChart(
        b.spec.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar,
        b.spec.series.map((s) => ({ name: s.name, labels: b.spec.categories, values: s.values })),
        {
          x: 0.5,
          y,
          w: 12.3,
          h: 3.4,
          barDir: b.spec.type === "hbar" ? "bar" : "col",
          barGrouping: b.spec.type === "stacked" ? "stacked" : "clustered",
          chartColors: SERIES.slice(0, Math.max(1, b.spec.series.length)),
          showLegend: b.spec.series.length > 1,
          legendPos: "t",
          legendFontSize: 9,
          catAxisLabelFontSize: 9,
          valAxisLabelFontSize: 9,
          valAxisLabelFormatCode: fmt,
          showTitle: true,
          title: b.title,
          titleFontSize: 11,
          titleColor: INK,
          showValue: b.spec.series.length === 1,
          dataLabelFormatCode: fmt,
          dataLabelFontSize: 8,
        },
      );
      return;
    }
  }
}
