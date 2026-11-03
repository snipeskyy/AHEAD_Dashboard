/**
 * SQLite FTS5 search index, kept in sync by triggers. Created idempotently at runtime by
 * ensureSearchIndex() (not by a Prisma migration, so `prisma migrate` never tries to manage
 * the virtual table). A Postgres SearchProvider would use tsvector instead.
 */
const SOURCES = [
  {
    type: "account",
    table: "Account",
    title: "new.name",
    body: "coalesce(new.industry,'') || ' ' || coalesce(new.subIndustry,'') || ' ' || coalesce(new.domain,'') || ' ' || coalesce(new.ticker,'') || ' ' || coalesce(new.ownerNotes,'')",
    accountId: "new.id",
    cols: "name, industry, subIndustry, domain, ticker, ownerNotes",
  },
  {
    type: "signal",
    table: "Signal",
    title: "new.title",
    body: "coalesce(new.summary,'')",
    accountId: "new.accountId",
    cols: "title, summary",
  },
  {
    type: "opportunity",
    table: "Opportunity",
    title: "new.name",
    body: "coalesce(new.nextStep,'') || ' ' || new.practiceArea",
    accountId: "new.accountId",
    cols: "name, nextStep, practiceArea",
  },
  {
    type: "note",
    table: "Note",
    title: "substr(new.body, 1, 80)",
    body: "new.body",
    accountId: "CASE WHEN new.entityType = 'account' THEN new.entityId ELSE NULL END",
    cols: "body, entityType, entityId",
  },
  {
    type: "play",
    table: "Play",
    title: "new.name",
    body: "new.valueHypothesis",
    accountId: "NULL",
    cols: "name, valueHypothesis",
  },
] as const;

export const SEARCH_INDEX_VERSION = 1;

export function searchIndexDDL(): string[] {
  const stmts: string[] = [
    `CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(entity_type UNINDEXED, entity_id UNINDEXED, account_id UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3 4')`,
  ];
  for (const s of SOURCES) {
    const ins = `INSERT INTO search_index(entity_type, entity_id, account_id, title, body) VALUES ('${s.type}', new.id, ${s.accountId}, ${s.title}, ${s.body});`;
    const del = `DELETE FROM search_index WHERE entity_type = '${s.type}' AND entity_id = old.id;`;
    stmts.push(
      `CREATE TRIGGER IF NOT EXISTS search_${s.type}_ai AFTER INSERT ON "${s.table}" BEGIN ${ins} END`,
    );
    stmts.push(
      `CREATE TRIGGER IF NOT EXISTS search_${s.type}_ad AFTER DELETE ON "${s.table}" BEGIN ${del} END`,
    );
    stmts.push(
      `CREATE TRIGGER IF NOT EXISTS search_${s.type}_au AFTER UPDATE OF ${s.cols} ON "${s.table}" BEGIN ${del} ${ins} END`,
    );
  }
  return stmts;
}

/** Full rebuild from source tables (used once on creation and by "Reset demo data"). */
export function searchIndexRebuild(): string[] {
  return [
    `DELETE FROM search_index`,
    ...SOURCES.map((s) => {
      const sel = (e: string) => e.replace(/new\./g, "");
      return `INSERT INTO search_index(entity_type, entity_id, account_id, title, body) SELECT '${s.type}', id, ${sel(s.accountId)}, ${sel(s.title)}, ${sel(s.body)} FROM "${s.table}"`;
    }),
  ];
}

export function searchIndexDropDDL(): string[] {
  return [
    ...SOURCES.flatMap((s) =>
      ["ai", "ad", "au"].map((k) => `DROP TRIGGER IF EXISTS search_${s.type}_${k}`),
    ),
    `DROP TABLE IF EXISTS search_index`,
  ];
}
