export type SearchEntityType = "account" | "signal" | "opportunity" | "note" | "play";

export interface SearchHit {
  entityType: SearchEntityType;
  entityId: string;
  accountId: string | null;
  title: string;
  snippet: string;
  rank: number;
}

export interface SearchProvider {
  id: string;
  ensureReady(): Promise<void>;
  search(
    query: string,
    opts?: { types?: SearchEntityType[]; limit?: number },
  ): Promise<SearchHit[]>;
  rebuild(): Promise<void>;
  /** Remove the index entirely (before bulk loads / schema migrations). */
  drop(): Promise<void>;
}

/** Turns free text into a safe FTS5 prefix query: `gpu clus` → `"gpu"* "clus"*`. */
export function toFtsQuery(input: string): string | null {
  const terms = input
    .toLowerCase()
    .replace(/["*^():]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}&.-]/gu, ""))
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(" ");
}
