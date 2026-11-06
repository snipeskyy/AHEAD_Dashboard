/**
 * Meeting notes → candidate tasks (pure, rules-based). Lines starting with "Action:", "Next:", "Next step:",
 * "TODO", "AI:" (action item), "- [ ]" or "[ ]" become tasks. Optional due hints: "by 2026-11-20", "by 11/20",
 * "by Friday", "tomorrow", "next week", "EOW".
 */
export interface ParsedAction {
  title: string;
  dueDate: Date | null;
  line: number;
}

const PREFIX = /^\s*(?:[-*•]\s*)?(?:\[\s?\]\s*|(?:action(?: item)?|next(?: step)?|todo|ai|follow[- ]?up)\s*[:\-–]\s*|todo\s+)/i;
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function dueHint(text: string, now: Date): { due: Date | null; rest: string } {
  const at = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 17));
  const rules: Array<[RegExp, (m: RegExpExecArray) => Date | null]> = [
    [/\bby (\d{4})-(\d{2})-(\d{2})\b/i, (m) => at(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])))],
    [/\bby (\d{1,2})\/(\d{1,2})\b/i, (m) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), +m[1] - 1, +m[2]));
      if (d < now) d.setUTCFullYear(d.getUTCFullYear() + 1);
      return at(d);
    }],
    [/\b(?:by )?tomorrow\b/i, () => at(new Date(now.getTime() + 86_400_000))],
    [/\b(?:by )?(?:eow|end of (?:the )?week)\b/i, () => at(new Date(now.getTime() + ((5 - now.getUTCDay() + 7) % 7 || 7) * 86_400_000))],
    [/\b(?:by )?next week\b/i, () => at(new Date(now.getTime() + 7 * 86_400_000))],
    [new RegExp(`\\bby (${DAYS.join("|")})\\b`, "i"), (m) => {
      const target = DAYS.indexOf(m[1].toLowerCase());
      const delta = (target - now.getUTCDay() + 7) % 7 || 7;
      return at(new Date(now.getTime() + delta * 86_400_000));
    }],
  ];
  for (const [re, fn] of rules) {
    const m = re.exec(text);
    if (m) return { due: fn(m), rest: text.replace(m[0], "").replace(/\s{2,}/g, " ").replace(/[\s,;-]+$/, "").trim() };
  }
  return { due: null, rest: text.trim() };
}

export function parseActions(notes: string, now: Date): ParsedAction[] {
  const out: ParsedAction[] = [];
  notes.split(/\r?\n/).forEach((raw, i) => {
    if (!PREFIX.test(raw)) return;
    const body = raw.replace(PREFIX, "").trim();
    if (body.length < 3) return;
    const { due, rest } = dueHint(body, now);
    out.push({ title: rest.slice(0, 200), dueDate: due, line: i + 1 });
  });
  return out;
}

/** "#ai #budget" style tags from notes text. */
export const parseTags = (notes: string) => [...new Set([...notes.matchAll(/(?:^|\s)#([a-z][\w-]{1,30})/gi)].map((m) => m[1].toLowerCase()))];
