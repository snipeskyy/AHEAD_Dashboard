import type { Block, ExportDocument } from "@/lib/export/types";
import { chartTakeaway, kpiNotes } from "./narrative";
import type { DeckOptions, LayoutId, Slide } from "./types";

const TABLE_ROWS = 8;
const BULLETS = 6;
const TWO_COL = 12;
const KPI_MAX = 8;

type Item = Extract<Block, { kind: "list" }>["items"][number];
const isRedacted = (blocks: Block[]) => blocks.some((b) => b.redacted);

/**
 * Plans an export document into slides (pure). Each block gets the layout that suits it:
 * kv → KPI tiles (or facts), chart (+ the paragraph/callout after it) → chart with takeaway,
 * table → paginated table, list → bullets / two columns, callout → quote. Section headings
 * (level 3) title the slides that follow. The cover section becomes the title slide.
 */
export function planSlides(doc: ExportDocument, opts: DeckOptions, view: { keepHidden?: boolean } = {}): Slide[] {
  const slides: Slide[] = [];
  const content = doc.sections.filter((s) => s.id !== "exports.cover" && s.blocks.length);
  // With a closing slide, the next-steps section *is* the closing slide (not repeated as content).
  const nextSection = opts.closing ? content.find((s) => s.id.endsWith("next-steps")) : undefined;
  const date = doc.dateStamp ? new Date(doc.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

  slides.push({
    id: "title",
    layout: "title",
    title: doc.title,
    subtitle: [doc.subtitle, doc.scopeLabel].filter(Boolean).join(" · "),
    kicker: [doc.preparedBy ? `Prepared by ${doc.preparedBy}` : "", date].filter(Boolean).join(" · "),
    blocks: [],
    notes: `${doc.title}. ${doc.audience === "customer" ? "Customer-facing version." : "Internal version: do not forward."}`,
  });
  if (opts.agenda && content.length >= 3)
    slides.push({
      id: "agenda",
      layout: "agenda",
      title: "Agenda",
      blocks: [{ kind: "list", ordered: true, items: content.map((s) => ({ text: s.title })) }],
      notes: `We'll cover ${content.length} topics: ${content.map((s) => s.title).join(", ")}.`,
    });

  for (const s of content) {
    if (s === nextSection) continue;
    if (opts.dividers)
      slides.push({ id: `${s.id}:divider`, layout: "divider", title: s.title, blocks: [], notes: "", sectionId: s.id, internalOnly: s.internalOnly });
    let n = 0;
    let heading: string | null = null;
    let textRun: Block[] = [];
    const push = (layout: LayoutId, blocks: Block[], extra: Partial<Slide> = {}) => {
      n++;
      slides.push({
        id: `${s.id}:${n}`,
        layout,
        title: heading ?? s.title,
        kicker: heading ? s.title : undefined,
        blocks,
        notes: "",
        sectionId: s.id,
        internalOnly: s.internalOnly,
        redacted: s.redacted || isRedacted(blocks),
        ...extra,
      });
    };
    const flushText = () => {
      if (!textRun.length) return;
      push("bullets", textRun, { notes: textRun.map((b) => (b.kind === "paragraph" ? b.text : "")).join(" ").trim() });
      textRun = [];
    };

    for (let i = 0; i < s.blocks.length; i++) {
      const b = s.blocks[i];
      if (b.kind === "heading") {
        flushText();
        heading = b.text;
        continue;
      }
      if (b.kind === "paragraph") {
        textRun.push(b);
        if (textRun.length >= 3) flushText();
        continue;
      }
      flushText();
      if (b.kind === "kv") {
        const layout = b.items.length <= KPI_MAX && b.items.every((x) => x.value.length <= 24) ? "kpis" : "facts";
        push(layout, [b], { notes: kpiNotes(b.items) });
      } else if (b.kind === "chart") {
        const next = s.blocks[i + 1];
        const takeawayBlock = next && (next.kind === "paragraph" || next.kind === "callout") ? next : null;
        if (takeawayBlock) i++;
        const auto = chartTakeaway(b.spec);
        const takeaway = takeawayBlock ? (takeawayBlock as { text: string }).text : (auto ?? undefined);
        push(takeaway ? "chart-takeaway" : "chart", [b], { title: heading ?? b.title ?? s.title, takeaway, notes: [takeaway, auto && takeawayBlock ? auto : null].filter(Boolean).join(" ") });
      } else if (b.kind === "table") {
        const pages = Math.max(1, Math.ceil(b.rows.length / TABLE_ROWS));
        for (let p = 0; p < pages; p++)
          push("table", [{ ...b, rows: b.rows.slice(p * TABLE_ROWS, (p + 1) * TABLE_ROWS) }], {
            subtitle: pages > 1 ? `${p + 1} of ${pages}` : undefined,
            notes: `${b.rows.length} rows${b.caption ? `: ${b.caption}` : ""}.`,
          });
      } else if (b.kind === "list") {
        const per = b.items.length <= BULLETS ? BULLETS : TWO_COL;
        const pages = Math.max(1, Math.ceil(b.items.length / per));
        for (let p = 0; p < pages; p++) {
          const items: Item[] = b.items.slice(p * per, (p + 1) * per);
          push(items.length <= BULLETS ? "bullets" : "two-column", [{ ...b, items }], {
            subtitle: pages > 1 ? `${p + 1} of ${pages}` : undefined,
            notes: items.map((x) => x.text).join("; "),
          });
        }
      } else if (b.kind === "callout") {
        push("quote", [b], { notes: b.text });
      } else if (b.kind === "image") {
        push("image", [b], { subtitle: b.caption, notes: b.alt });
      }
    }
    flushText();
  }

  if (opts.closing) {
    const next = nextSection;
    // All of the section's list items (agreed actions first), capped to what fits on one slide.
    const items = next ? next.blocks.flatMap((b) => (b.kind === "list" ? b.items : [])).slice(0, 7) : [];
    slides.push({
      id: "closing",
      layout: "closing",
      title: next ? "Next steps" : "Thank you",
      kicker: doc.preparedBy || undefined,
      blocks: items.length ? [{ kind: "list", items }] : [],
      notes: next ? "Confirm owners and dates before we leave the room." : "Questions and discussion.",
    });
  }

  // The builder keeps hidden slides (dimmed, so they can be shown again); renderers drop them.
  return slides
    .map((sl) => ({ ...sl, hidden: opts.hiddenSlides.includes(sl.id), notes: opts.notes[sl.id] ?? sl.notes }))
    .filter((sl) => view.keepHidden || !sl.hidden);
}
