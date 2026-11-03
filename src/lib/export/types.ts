/**
 * Renderer-agnostic document model for executive summaries. Section builders (server) produce
 * blocks; redaction removes/marks fields; renderers (HTML preview/print, Markdown, PPTX) consume it.
 * `field` ties a block / item / column to an ExportFieldDefinition id for redaction.
 */
export type ValueFormat = "currency" | "number" | "percent";

export interface ChartSpec {
  type: "bar" | "hbar" | "line" | "stacked";
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
  valueFormat?: ValueFormat;
  /** Optional horizontal reference line (e.g. target). */
  reference?: { label: string; value: number };
}

export interface Cell {
  text: string;
  href?: string;
}

interface Redactable {
  field?: string;
  /** Set in redaction PREVIEW mode instead of removing. */
  redacted?: boolean;
}

export type Block =
  | ({ kind: "heading"; text: string; level?: 2 | 3 } & Redactable)
  | ({ kind: "paragraph"; text: string } & Redactable)
  | ({ kind: "kv"; items: Array<{ label: string; value: string } & Redactable> } & Redactable)
  | ({
      kind: "table";
      caption?: string;
      columns: Array<{ key: string; label: string; align?: "left" | "right" } & Redactable>;
      rows: Array<Record<string, Cell>>;
    } & Redactable)
  | ({
      kind: "list";
      ordered?: boolean;
      items: Array<{ text: string; sub?: string; href?: string } & Redactable>;
    } & Redactable)
  | ({ kind: "chart"; title: string; spec: ChartSpec; svg?: string } & Redactable)
  | ({ kind: "callout"; text: string; tone?: "info" | "warning" } & Redactable);

export interface DocSection {
  id: string;
  moduleId: string;
  title: string;
  internalOnly?: boolean;
  redacted?: boolean;
  blocks: Block[];
}

export interface ExportDocument {
  title: string;
  subtitle: string;
  scopeLabel: string;
  audience: "internal" | "customer";
  generatedAt: string;
  version: number;
  watermark: string;
  dateStamp: boolean;
  preparedBy: string;
  isDemo: boolean;
  sections: DocSection[];
  redaction: { removedFields: string[]; removedSections: string[]; mode: "apply" | "preview" };
}
