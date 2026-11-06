/**
 * Enrichment persistence (no "server-only": used by the worker and route handlers alike).
 * Every write goes through applyValue() so provenance, history, locking and column mirroring stay consistent.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { inferSeniority } from "@/lib/import/kinds/contacts";
import { audit } from "@/lib/db-extensions";
import { columnValue, FIELD_BY_ID, listKind } from "./fields";
import { decide, type Confidence } from "./merge";
import type { EnrichResult, ProposalInput } from "./types";

type Db = PrismaClient | Prisma.TransactionClient;
const json = (v: unknown) => v as Prisma.InputJsonValue;
const CONF_NUM = { high: 0.85, medium: 0.6, low: 0.35 } as const;

export async function currentFields(db: Db, accountId: string) {
  const rows = await db.accountField.findMany({ where: { accountId } });
  return new Map(rows.map((r) => [r.field, r]));
}

/** Writes a field value with provenance + history, mirrors the Account column and source config. */
export async function applyValue(
  db: Db,
  accountId: string,
  field: string,
  value: unknown,
  meta: {
    source: string;
    sourceUrl?: string | null;
    confidence: Confidence;
    fetchedAt?: Date | null;
    lock?: boolean;
  },
) {
  const prev = await db.accountField.findUnique({
    where: { accountId_field: { accountId, field } },
  });
  const locked = meta.lock ?? (meta.confidence === "user" ? true : (prev?.locked ?? false));
  await db.accountField.upsert({
    where: { accountId_field: { accountId, field } },
    create: {
      accountId,
      field,
      value: json(value),
      source: meta.source,
      sourceUrl: meta.sourceUrl ?? null,
      confidence: meta.confidence,
      fetchedAt: meta.fetchedAt ?? null,
      locked,
    },
    update: {
      value: json(value),
      source: meta.source,
      sourceUrl: meta.sourceUrl ?? null,
      confidence: meta.confidence,
      fetchedAt: meta.fetchedAt ?? null,
      locked,
    },
  });
  await db.accountFieldHistory.create({
    data: {
      accountId,
      field,
      oldValue: prev ? json(prev.value) : undefined,
      newValue: json(value),
      source: meta.source,
      sourceUrl: meta.sourceUrl ?? null,
    },
  });
  const def = FIELD_BY_ID.get(field);
  const col = def ? columnValue(def, value) : undefined;
  const data: Prisma.AccountUpdateInput = {};
  if (def?.column && col !== undefined) (data as Record<string, unknown>)[def.column] = col;
  if (field === "web.jobBoard" || field === "web.newsroomRss") {
    const acc = await db.account.findUnique({
      where: { id: accountId },
      select: { sourceConfig: true },
    });
    const cfg = { ...((acc?.sourceConfig ?? {}) as Record<string, unknown>) };
    if (field === "web.jobBoard") {
      const jb = value as { provider: string; slug: string };
      cfg[`${jb.provider}Slug`] = jb.slug; // greenhouseSlug | leverSlug | ashbySlug | smartrecruitersSlug
    } else {
      const feeds = new Set((cfg.rssFeeds as string[] | undefined) ?? []);
      feeds.add(String(value));
      cfg.rssFeeds = [...feeds];
    }
    data.sourceConfig = json(cfg);
  }
  if (Object.keys(data).length) await db.account.update({ where: { id: accountId }, data });
}

/** Lock/unlock a field (user edits lock automatically). */
export const setLocked = (db: Db, accountId: string, field: string, locked: boolean) =>
  db.accountField.updateMany({ where: { accountId, field }, data: { locked } });

/**
 * Stores an enricher's output: facts tables are upserted; each proposal is applied, kept for review,
 * or dropped when it repeats the current value. Older pending proposals from the same enricher for the
 * same field are superseded so the review list never grows stale duplicates.
 */
export async function recordResult(
  db: PrismaClient,
  accountId: string,
  enricherId: string,
  source: string,
  result: EnrichResult,
  opts: { autoApply: boolean; now: Date },
) {
  const current = await currentFields(db, accountId);
  let applied = 0;
  let pending = 0;
  for (const p of result.proposals) {
    const cur = current.get(p.field);
    const d = decide(
      cur
        ? { value: cur.value, confidence: cur.confidence as Confidence, locked: cur.locked }
        : null,
      p,
      opts,
    );
    if (d === "same") continue;
    await db.fieldProposal.updateMany({
      where: { accountId, field: p.field, enricherId, status: "pending" },
      data: { status: "superseded", decidedAt: opts.now },
    });
    // List items with the same key and value that were already decided are not proposed again.
    if (listKind(p.field)) {
      const seen = await db.fieldProposal.findFirst({
        where: { accountId, field: p.field, status: { in: ["accepted", "rejected"] } },
      });
      if (seen) continue;
    }
    const status = d === "apply" ? "applied" : "pending";
    await db.fieldProposal.create({
      data: {
        accountId,
        field: p.field,
        value: json(p.value),
        enricherId,
        source: p.source ?? source,
        sourceUrl: p.sourceUrl,
        confidence: p.confidence,
        evidenceSnippet: p.evidenceSnippet ?? null,
        status,
        fetchedAt: opts.now,
        decidedAt: d === "apply" ? opts.now : null,
      },
    });
    if (d === "apply") {
      await applyValue(db, accountId, p.field, p.value, {
        source: enricherId,
        sourceUrl: p.sourceUrl,
        confidence: p.confidence,
        fetchedAt: opts.now,
      });
      applied++;
    } else pending++;
  }
  for (const f of result.financials ?? [])
    await db.financialFact.upsert({
      where: {
        accountId_metric_periodEnd: { accountId, metric: f.metric, periodEnd: f.periodEnd },
      },
      create: { accountId, ...f },
      update: { value: f.value, fiscalYear: f.fiscalYear, sourceUrl: f.sourceUrl },
    });
  for (const r of result.relations ?? [])
    await db.corporateRelation.upsert({
      where: { accountId_relation_name: { accountId, relation: r.relation, name: r.name } },
      create: { accountId, ...r },
      update: {
        lei: r.lei ?? null,
        wikidataId: r.wikidataId ?? null,
        country: r.country ?? null,
        source: r.source,
        sourceUrl: r.sourceUrl,
      },
    });
  return { applied, pending };
}

/** Accept one proposal: scalar fields become user-verified values; list items become their own records. */
export async function acceptProposal(db: PrismaClient, id: string, now = new Date()) {
  const p = await db.fieldProposal.findUnique({ where: { id } });
  if (!p || p.status !== "pending") return null;
  const v = p.value as Record<string, unknown>;
  const conf = CONF_NUM[p.confidence as keyof typeof CONF_NUM] ?? 0.5;
  switch (listKind(p.field)) {
    case "initiative":
      await db.initiative.create({
        data: {
          accountId: p.accountId,
          title: String(v.title),
          description: (v.description as string) ?? null,
          practiceAreas: json(v.practiceAreas ?? []),
          evidence: p.evidenceSnippet,
          section: (v.section as string) ?? null,
          source: (v.kind as string) ?? "filing",
          sourceUrl: p.sourceUrl,
          confidence: conf,
        },
      });
      break;
    case "tech":
      await db.techStackHypothesis.create({
        data: {
          accountId: p.accountId,
          category: String(v.category),
          technology: String(v.technology),
          evidence: p.evidenceSnippet ?? String(v.evidence ?? ""),
          sourceUrl: p.sourceUrl,
          source: (v.kind as string) ?? "web",
          confidence: conf,
        },
      });
      break;
    case "contact":
      await db.contact.create({
        data: {
          accountId: p.accountId,
          displayName: String(v.name),
          title: String(v.title),
          function: (v.function as string) ?? "Executive",
          seniority: inferSeniority(String(v.title)),
          buyingRole: "Influencer",
          source: p.enricherId,
          sourceUrl: p.sourceUrl,
        },
      });
      break;
    default:
      await applyValue(db, p.accountId, p.field, p.value, {
        source: p.enricherId,
        sourceUrl: p.sourceUrl,
        confidence: "verified",
        fetchedAt: p.fetchedAt,
      });
      await db.fieldProposal.updateMany({
        where: { accountId: p.accountId, field: p.field, status: "pending", id: { not: id } },
        data: { status: "superseded", decidedAt: now },
      });
  }
  await db.fieldProposal.update({ where: { id }, data: { status: "accepted", decidedAt: now } });
  await audit(db, { action: "enrichment.accept", entityType: "account", entityId: p.accountId, summary: `Accepted ${p.field} from ${p.source}`, meta: { proposalId: id, field: p.field, sourceUrl: p.sourceUrl } });
  return p;
}

export async function rejectProposal(db: PrismaClient, id: string, now = new Date()) {
  const p = await db.fieldProposal.findUnique({ where: { id }, select: { accountId: true, field: true, source: true } });
  const r = await db.fieldProposal.updateMany({ where: { id, status: "pending" }, data: { status: "rejected", decidedAt: now } });
  if (p && r.count) await audit(db, { action: "enrichment.reject", entityType: "account", entityId: p.accountId, summary: `Rejected ${p.field} from ${p.source}`, meta: { proposalId: id } });
  return r;
}

/** The user typed a value: highest precedence, locked against enrichment. */
export async function setManualValue(db: PrismaClient, accountId: string, field: string, value: unknown) {
  const r = await applyValue(db, accountId, field, value, { source: "user", confidence: "user", lock: true });
  await audit(db, { action: "enrichment.manual", entityType: "account", entityId: accountId, summary: `Set ${field} by hand (locked)` });
  return r;
}

export type { ProposalInput };
