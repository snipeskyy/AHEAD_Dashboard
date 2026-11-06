/** Pure @mention helpers (unit-tested). Mentions are `@Display Name` tokens matched against known users. */
export interface MentionUser {
  id: string;
  displayName: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ids of users mentioned in `body`. Longest names match first so "@Sam Lee" beats "@Sam". */
export function findMentions(body: string, users: MentionUser[]): string[] {
  const found = new Set<string>();
  let rest = body;
  for (const u of [...users].sort((a, b) => b.displayName.length - a.displayName.length)) {
    const re = new RegExp(`(^|[^\\w@])@${esc(u.displayName)}(?![\\w])`, "gi");
    if (re.test(rest)) {
      found.add(u.id);
      rest = rest.replace(re, "$1");
    }
  }
  return [...found];
}

/** The partial "@query" being typed at `caret`, or null. */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([\w .'-]{0,30})$/.exec(before);
  if (!m) return null;
  const query = m[2];
  if (query.includes("  ")) return null;
  return { start: caret - query.length - 1, query };
}

/** Replace the "@query" at `start` with "@Name ". Returns the new text and caret. */
export function insertMention(text: string, start: number, caret: number, name: string) {
  const next = `${text.slice(0, start)}@${name} ${text.slice(caret)}`;
  return { text: next, caret: start + name.length + 2 };
}
