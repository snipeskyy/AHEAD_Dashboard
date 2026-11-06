import type { Block } from "@/lib/export/types";

/**
 * Presentation model (Phase 10). An ExportDocument (sections of blocks) is planned into slides with a
 * layout each; renderers (PPTX, HTML for PDF / preview / presenting) draw layouts with a DeckTheme.
 */
export const LAYOUTS = [
  "title", // deck title, subtitle, prepared by, date
  "agenda", // numbered section list
  "divider", // section title page
  "kpis", // up to 8 metric tiles
  "facts", // label/value list in two columns (long kv)
  "chart", // one chart, full width
  "chart-takeaway", // chart left, takeaway + supporting points right
  "table", // paginated table
  "bullets", // title + up to 6 bullets / paragraphs
  "two-column", // 7–12 bullets in two columns
  "quote", // a callout, large
  "closing", // next steps / thank-you
] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export interface Slide {
  /** Stable within a deck: "title", "agenda", "<sectionId>:<n>", "closing". Used for hide/notes overrides. */
  id: string;
  layout: LayoutId;
  title: string;
  /** Small line above the title (usually the section name). */
  kicker?: string;
  subtitle?: string;
  blocks: Block[];
  /** Template-written takeaway (never invented: derived from the slide's own data). */
  takeaway?: string;
  notes: string;
  sectionId?: string;
  internalOnly?: boolean;
  /** Redaction preview: content on this slide would be removed. */
  redacted?: boolean;
  /** Hidden by the user (kept only in the builder view). */
  hidden?: boolean;
}

export interface DeckOptions {
  agenda: boolean;
  dividers: boolean;
  closing: boolean;
  hiddenSlides: string[];
  notes: Record<string, string>;
}

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  agenda: true,
  dividers: false,
  closing: true,
  hiddenSlides: [],
  notes: {},
};

/** Colors are 6-digit hex without '#', as pptxgenjs expects; HTML renderers add '#'. */
export interface DeckTheme {
  name: string;
  primary: string;
  onPrimary: string;
  ink: string;
  muted: string;
  surface: string;
  soft: string;
  rule: string;
  series: string[];
  fontHead: string;
  fontBody: string;
  /** data: URL of the brand logo (local brand pack only). */
  logo?: string | null;
  footerNote?: string | null;
}
