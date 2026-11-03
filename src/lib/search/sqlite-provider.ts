import type { PrismaClient } from "@prisma/client";
import { searchIndexDDL, searchIndexDropDDL, searchIndexRebuild } from "./sqlite-fts.sql";
import { toFtsQuery, type SearchEntityType, type SearchHit, type SearchProvider } from "./types";

export function createSqliteSearchProvider(db: PrismaClient): SearchProvider {
  let ready: Promise<void> | null = null;
  const provider: SearchProvider = {
    id: "sqlite-fts5",
    ensureReady() {
      ready ??= (async () => {
        const existed = await db.$queryRawUnsafe<Array<{ name: string }>>(
          `SELECT name FROM sqlite_master WHERE name = 'search_index'`,
        );
        for (const s of searchIndexDDL()) await db.$executeRawUnsafe(s);
        if (!existed.length) await provider.rebuild();
      })();
      return ready;
    },
    async drop() {
      for (const s of searchIndexDropDDL()) await db.$executeRawUnsafe(s);
      ready = null;
    },
    async rebuild() {
      for (const s of searchIndexRebuild()) await db.$executeRawUnsafe(s);
    },
    async search(query, opts = {}) {
      await provider.ensureReady();
      const q = toFtsQuery(query);
      if (!q) return [];
      const limit = Math.min(opts.limit ?? 20, 100);
      const types = opts.types?.length ? opts.types : null;
      const typeClause = types ? `AND entity_type IN (${types.map(() => "?").join(",")})` : "";
      const rows = await db.$queryRawUnsafe<
        Array<{
          entity_type: SearchEntityType;
          entity_id: string;
          account_id: string | null;
          title: string;
          snippet: string;
          rank: number;
        }>
      >(
        `SELECT entity_type, entity_id, account_id, title, snippet(search_index, 4, '[', ']', '…', 10) AS snippet, bm25(search_index, 0, 0, 0, 8.0, 1.0) AS rank
         FROM search_index WHERE search_index MATCH ? ${typeClause}
         ORDER BY rank LIMIT ${limit}`,
        q,
        ...(types ?? []),
      );
      return rows.map<SearchHit>((r) => ({
        entityType: r.entity_type,
        entityId: r.entity_id,
        accountId: r.account_id,
        title: r.title,
        snippet: r.snippet,
        rank: Number(r.rank),
      }));
    },
  };
  return provider;
}
