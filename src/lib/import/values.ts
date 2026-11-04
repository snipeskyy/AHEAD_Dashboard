/** Lenient cell parsers shared by import kinds. All pure. */

export const cell = (v: unknown) =>
  typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Matches a value against enum ids or labels, ignoring case, spaces and punctuation. */
export function matchEnum<T extends string>(
  input: string,
  values: readonly T[],
  labels: Partial<Record<T, string>> = {},
  synonyms: Record<string, T> = {},
): T | null {
  const k = squash(input);
  if (!k) return null;
  for (const v of values) if (squash(v) === k || squash(labels[v] ?? "") === k) return v;
  return synonyms[k] ?? null;
}

/** "$1.2M", "250k", "1,200,000", "USD 40000" → number. */
export function parseAmount(input: string): number | null {
  const s = input.toLowerCase().replace(/usd|\$|,|\s/g, "");
  if (!s) return null;
  const m = /^(-?\d+(?:\.\d+)?)([kmb])?$/.exec(s);
  if (!m) return null;
  const mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** ISO (2026-03-31), US (3/31/2026), or long form (Mar 31 2026). Returns UTC midnight. */
export function parseDate(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return utc(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) return utc(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return utc(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function utc(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 ? date : null;
}

export function parsePercent(input: string): number | null {
  const n = Number(input.replace("%", "").trim());
  if (!input.trim() || !Number.isFinite(n)) return null;
  const v = n > 0 && n <= 1 && input.includes(".") && !input.includes("%") ? n * 100 : n;
  return v >= 0 && v <= 100 ? Math.round(v) : null;
}

/** "a; b | c" → ["a", "b", "c"]. */
export const splitList = (input: string) =>
  input
    .split(/[;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

const LEGAL_SUFFIXES =
  /\b(incorporated|inc|corporation|corp|company|co|llc|l\.l\.c|ltd|limited|plc|lp|llp|gmbh|ag|sa|nv|bv|holdings?|group)\b\.?/g;

/** For dedupe: "The Acme Corp., Inc." and "acme" compare equal. */
export function normalizeLegalName(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
