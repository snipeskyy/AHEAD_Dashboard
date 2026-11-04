import { normalizeDomain } from "./normalize";
import type { ImportField, MappedRow } from "./types";

export type ColumnMapping = Record<string, string | undefined>; // fieldId → source header

const key = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");

/** Exact alias match first, then the field label; each header is used at most once. */
export function autoMap(fields: ImportField[], headers: string[]): ColumnMapping {
  const used = new Set<string>();
  const out: ColumnMapping = {};
  const pick = (f: ImportField, test: (h: string) => boolean) => {
    if (out[f.id]) return;
    const h = headers.find((x) => !used.has(x) && test(key(x)));
    if (h) {
      out[f.id] = h;
      used.add(h);
    }
  };
  for (const f of fields) pick(f, (h) => f.aliases.includes(h));
  for (const f of fields) pick(f, (h) => h === key(f.label));
  return out;
}

/** Applies a mapping, keeping only mapped fields. Headers that no longer exist are ignored. */
export function applyMapping(
  rows: Array<Record<string, string>>,
  mapping: ColumnMapping,
): MappedRow[] {
  const pairs = Object.entries(mapping).filter((p): p is [string, string] => !!p[1]);
  return rows.map((r) => Object.fromEntries(pairs.map(([f, h]) => [f, r[h] ?? ""])));
}

/** A saved mapping fits a file when every header it maps still exists. */
export const mappingFits = (mapping: ColumnMapping, headers: string[]) =>
  Object.values(mapping).every((h) => !h || headers.includes(h));

/**
 * Pasted list → rows. One company per line, optionally with a domain:
 * "Acme Corp", "Acme Corp, acme.com", "Acme Corp<TAB>acme.com", "Acme Corp (acme.com)", "acme.com".
 */
export function parsePastedList(text: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    let name = line;
    let domain = "";
    const paren = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(line);
    const split = line.split(/\t|\s+[|,;]\s*|,\s*/);
    if (paren && normalizeDomain(paren[2])) [name, domain] = [paren[1], paren[2]];
    else if (split.length >= 2 && normalizeDomain(split.at(-1)!))
      [name, domain] = [split.slice(0, -1).join(", "), split.at(-1)!];
    else if (normalizeDomain(line) && !/\s/.test(line)) [name, domain] = ["", line];
    rows.push({ Company: name.trim(), Domain: domain.trim() });
  }
  return rows;
}

/** CSV text for a downloadable template: header row + one example row. */
export function templateCsv(fields: ImportField[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [fields.map((f) => esc(f.label)), fields.map((f) => esc(f.example))]
    .map((r) => r.join(","))
    .join("\n")
    .concat("\n");
}
