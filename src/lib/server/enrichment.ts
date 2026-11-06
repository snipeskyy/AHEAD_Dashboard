import "server-only";
import type { Tier } from "@/lib/domain/enums";
import { db } from "@/lib/db";
import { completeness } from "@/lib/enrich/completeness";
import { FIELD_DEFS, listKind } from "@/lib/enrich/fields";
import { createEnrichHttp, enrichUserAgent } from "@/lib/enrich/http";
import { findCandidates } from "@/lib/enrich/identity";
import { ENRICHERS, blockedReason, enabledEnrichers } from "@/lib/enrich/registry";
import { enqueueEnrichment, loadIdentity } from "@/lib/enrich/runner";
import { enrichStatus } from "@/lib/enrich/status";
import { applyValue } from "@/lib/enrich/store";
import { logActivity } from "./activity";
import { HttpError } from "./http";

const TTL = Object.fromEntries(ENRICHERS.map((e) => [e.id, e.ttlDays]));
/** Field ids that count as filled when the mirrored Account column has a value (e.g. typed before enrichment). */
const COLUMN_FILLED: Array<[string, (a: Record<string, unknown>) => boolean]> = FIELD_DEFS.filter(
  (f) => f.column,
).map((f) => [
  f.id,
  (a) => {
    const v = a[f.column!];
    return v !== null && v !== undefined && v !== "" && v !== "Unclassified";
  },
]);

/** Status + completeness for many accounts at once (Accounts table columns). */
export async function enrichmentOverview(accountIds?: string[]) {
  const where = accountIds ? { id: { in: accountIds } } : { isDemo: false };
  const [accounts, fields, jobs, runs, pending, contacts, initiatives] = await Promise.all([
    db.account.findMany({
      where,
      select: {
        id: true,
        tier: true,
        industry: true,
        hq: true,
        employeeBand: true,
        revenueBand: true,
        cik: true,
        ticker: true,
        lei: true,
        wikidataId: true,
        fiscalYearEnd: true,
        domain: true,
      },
    }),
    db.accountField.findMany({
      where: accountIds ? { accountId: { in: accountIds } } : {},
      select: { accountId: true, field: true },
    }),
    db.enrichmentJob.findMany({
      where: { status: { in: ["queued", "running", "failed"] } },
      orderBy: { createdAt: "desc" },
      select: { accountId: true, status: true },
    }),
    db.enrichmentRun.findMany({
      select: { accountId: true, enricherId: true, finishedAt: true, ok: true },
    }),
    db.fieldProposal.groupBy({ by: ["accountId"], where: { status: "pending" }, _count: true }),
    db.contact.groupBy({ by: ["accountId"], _count: true }),
    db.initiative.groupBy({ by: ["accountId"], _count: true }),
  ]);
  const by = <T extends { accountId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.accountId, [...(m.get(r.accountId) ?? []), r]);
    return m;
  };
  const F = by(fields);
  const R = by(runs);
  const J = new Map<string, { status: string }>();
  for (const j of jobs) if (!J.has(j.accountId)) J.set(j.accountId, j);
  const P = new Map(pending.map((p) => [p.accountId, p._count]));
  const C = new Map(contacts.map((p) => [p.accountId, p._count]));
  const I = new Map(initiatives.map((p) => [p.accountId, p._count]));
  const now = new Date();
  return accounts.map((a) => {
    const filled = new Set((F.get(a.id) ?? []).map((f) => f.field));
    for (const [id, test] of COLUMN_FILLED) if (test(a)) filled.add(id);
    const c = completeness({
      tier: a.tier as Tier,
      filled,
      contacts: C.get(a.id) ?? 0,
      initiatives: I.get(a.id) ?? 0,
    });
    return {
      accountId: a.id,
      status: enrichStatus({
        job: J.get(a.id) ?? null,
        runs: R.get(a.id) ?? [],
        pending: P.get(a.id) ?? 0,
        ttlDays: TTL,
        now,
      }),
      completeness: c.pct,
      pending: P.get(a.id) ?? 0,
      missing: c.missing,
    };
  });
}

/** Everything Account 360 needs for the Profile tab. */
export async function accountEnrichment(accountId: string) {
  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) throw new HttpError(404, "Account not found");
  const [fields, proposals, runs, financials, relations, hiring, job, [overview]] =
    await Promise.all([
      db.accountField.findMany({ where: { accountId } }),
      db.fieldProposal.findMany({
        where: { accountId, status: "pending" },
        orderBy: [{ field: "asc" }, { confidence: "asc" }],
      }),
      db.enrichmentRun.findMany({ where: { accountId }, orderBy: { startedAt: "desc" }, take: 60 }),
      db.financialFact.findMany({ where: { accountId }, orderBy: { periodEnd: "asc" } }),
      db.corporateRelation.findMany({
        where: { accountId },
        orderBy: [{ relation: "asc" }, { name: "asc" }],
      }),
      db.accountFieldHistory.findMany({
        where: { accountId, field: "hiring.snapshot" },
        orderBy: { changedAt: "asc" },
        take: 52,
      }),
      db.enrichmentJob.findFirst({ where: { accountId }, orderBy: { createdAt: "desc" } }),
      enrichmentOverview([accountId]),
    ]);
  const identity = await loadIdentity(db, accountId);
  const env = { secUserAgent: process.env.SEC_USER_AGENT?.trim() || null };
  const enabled = new Set((await enabledEnrichers(db)).map((e) => e.id));
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.enricherId)) latest.set(r.enricherId, r);
  return {
    identity,
    identityConfirmedAt: account.identityConfirmedAt,
    fields,
    proposals,
    financials,
    relations,
    hiringHistory: hiring.map((h) => ({ at: h.changedAt, value: h.newValue })),
    job,
    status: overview?.status ?? "not-enriched",
    completeness: overview?.completeness ?? 0,
    missing: overview?.missing ?? [],
    enrichers: ENRICHERS.map((e) => ({
      id: e.id,
      label: e.label,
      source: e.source,
      optional: !!e.optional,
      enabled: enabled.has(e.id),
      blocked: identity ? blockedReason(e, identity, env) : "Account not found",
      lastRun: latest.get(e.id) ?? null,
      ttlDays: e.ttlDays,
    })),
  };
}

export async function identityCandidates(accountId: string) {
  const a = await db.account.findUnique({
    where: { id: accountId },
    select: { name: true, domain: true, ticker: true },
  });
  if (!a) throw new HttpError(404, "Account not found");
  const secUa = process.env.SEC_USER_AGENT?.trim() || null;
  const ctrl = AbortSignal.timeout(45_000);
  const http = createEnrichHttp(db, secUa ?? enrichUserAgent(), ctrl);
  return findCandidates({ http }, a, { sec: !!secUa });
}

/** Confirm (or override) identifiers. User-confirmed values are locked against enrichment and re-trigger it. */
export async function confirmIdentity(
  accountId: string,
  ids: {
    cik?: string | null;
    ticker?: string | null;
    lei?: string | null;
    wikidataId?: string | null;
    domain?: string | null;
    legalName?: string | null;
  },
) {
  const map: Array<[keyof typeof ids, string]> = [
    ["cik", "identity.cik"],
    ["ticker", "identity.ticker"],
    ["lei", "identity.lei"],
    ["wikidataId", "identity.wikidataId"],
    ["domain", "firmographics.website"],
    ["legalName", "identity.legalName"],
  ];
  for (const [k, field] of map) {
    const v = ids[k];
    if (v === undefined) continue;
    if (v === null || v === "") {
      await db.accountField.deleteMany({ where: { accountId, field } });
      const col = FIELD_DEFS.find((f) => f.id === field)?.column;
      if (col) await db.account.update({ where: { id: accountId }, data: { [col]: null } });
      continue;
    }
    await applyValue(db, accountId, field, k === "cik" ? v.padStart(10, "0") : v, {
      source: "user",
      confidence: "user",
      lock: true,
    });
  }
  const a = await db.account.update({
    where: { id: accountId },
    data: { identityConfirmedAt: new Date() },
  });
  await logActivity({
    entityType: "account",
    entityId: accountId,
    action: "identity.confirmed",
    summary: `Identity confirmed for ${a.name}`,
  });
  await enqueueEnrichment(db, [accountId], { force: true });
  return { ok: true };
}

export async function decideProposals(
  accountId: string,
  action: "accept" | "reject",
  filter: { ids?: string[]; section?: string },
) {
  const { acceptProposal, rejectProposal } = await import("@/lib/enrich/store");
  const rows = await db.fieldProposal.findMany({
    where: { accountId, status: "pending", ...(filter.ids ? { id: { in: filter.ids } } : {}) },
  });
  const sectionOf = (field: string) =>
    listKind(field) ?? FIELD_DEFS.find((f) => f.id === field)?.section ?? "other";
  let n = 0;
  // Accept-all takes the highest-confidence value per field; the rest are superseded by acceptProposal().
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  for (const p of rows
    .filter((r) => !filter.section || sectionOf(r.field) === filter.section)
    .sort((a, b) => rank[a.confidence] - rank[b.confidence])) {
    if (
      action === "accept" ? await acceptProposal(db, p.id) : (await rejectProposal(db, p.id)).count
    )
      n++;
  }
  await logActivity({
    entityType: "account",
    entityId: accountId,
    action: `proposals.${action}`,
    summary: `${action === "accept" ? "Accepted" : "Rejected"} ${n} enrichment proposal${n === 1 ? "" : "s"}`,
  });
  return { [action === "accept" ? "accepted" : "rejected"]: n };
}
