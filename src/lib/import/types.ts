export const IMPORT_KINDS = [
  "accounts",
  "contacts",
  "opportunities",
  "notes",
  "partner-reps",
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const INPUT_TYPES = ["csv", "xlsx", "paste"] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export interface ImportField {
  id: string;
  label: string;
  required?: boolean;
  /** Lower-case header names that auto-map to this field. */
  aliases: string[];
  /** Example value used in the downloadable template. */
  example: string;
  hint?: string;
}

export interface RowIssue {
  field?: string;
  message: string;
}

export type NormalizeResult<T> = { ok: true; value: T } | { ok: false; errors: RowIssue[] };

/** A raw record after column mapping: fieldId → cell text. */
export type MappedRow = Record<string, string>;

export interface ImportKindDef<T = unknown> {
  id: ImportKind;
  label: string;
  singular: string;
  description: string;
  fields: ImportField[];
  /** Pure: trims, validates and normalizes one mapped row. */
  normalize(row: MappedRow): NormalizeResult<T>;
}
