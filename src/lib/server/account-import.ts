import "server-only";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { db } from "@/lib/db";
import { normalizeImportRow, type ImportRowInput } from "@/lib/import/normalize";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { logActivity } from "./activity";

/**
 * Creates REAL (non-demo) accounts from public identifiers only.
 * No intelligence is generated: initiatives / tech stack / signals arrive later
 * exclusively from public-source adapters or user-entered hypotheses.
 */
export async function createRealAccounts(rows: ImportRowInput[]) {
  const existing = await db.account.findMany({ select: { name: true, domain: true } });
  const names = new Set(existing.map((e) => e.name.toLowerCase()));
  const domains = new Set(existing.map((e) => e.domain?.toLowerCase()).filter(Boolean) as string[]);
  const created: Array<{ id: string; name: string }> = [];
  const skipped: Array<{ row: number; name: string; reason: string }> = [];

  for (const [i, raw] of rows.entries()) {
    const r = normalizeImportRow(raw);
    if (!r.ok) {
      skipped.push({ row: i + 1, name: String(raw.name ?? ""), reason: r.error });
      continue;
    }
    const v = r.value;
    if (names.has(v.name.toLowerCase()) || (v.domain && domains.has(v.domain))) {
      skipped.push({
        row: i + 1,
        name: v.name,
        reason: "Duplicate (name or domain already exists)",
      });
      continue;
    }
    const a = await db.account.create({
      data: {
        name: v.name,
        domain: v.domain,
        ticker: v.ticker,
        industry: v.industry ?? "Unclassified",
        tier: v.tier,
        isDemo: false,
        sourceConfig: {
          googleNews: true,
          rssFeeds: [],
          greenhouseSlug: v.greenhouseSlug,
          leverSlug: v.leverSlug,
        },
        practiceStatus: {
          create: DEFAULT_PRACTICE_AREAS.map((p) => ({ practiceArea: p.id, status: "NotEngaged" })),
        },
      },
    });
    names.add(v.name.toLowerCase());
    if (v.domain) domains.add(v.domain);
    created.push({ id: a.id, name: a.name });
  }
  if (created.length) {
    await computeScoresForAccounts(db, { now: new Date(), accountIds: created.map((c) => c.id) });
    await logActivity({
      entityType: "workspace",
      entityId: "import",
      action: "accounts.imported",
      summary: `Imported ${created.length} account${created.length > 1 ? "s" : ""}: ${created
        .slice(0, 3)
        .map((c) => c.name)
        .join(", ")}${created.length > 3 ? "…" : ""}`,
    });
  }
  return { created, skipped };
}
