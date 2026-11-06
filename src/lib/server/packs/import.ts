import "server-only";
import type { Prisma } from "@prisma/client";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { ensureLocalUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/domain/enums";
import { normalizeDomain, normalizeTicker } from "@/lib/import/normalize";
import { normalizeLegalName } from "@/lib/import/values";
import { intelPolicyViolation } from "@/lib/intel/policy";
import { computeScoresForAccounts } from "@/lib/scoring/account-scores";
import { PackSchema, proposalConfidence, type Pack, type PackAccount } from "@/lib/team/pack-schema";
import { findMentions } from "@/lib/team/mentions";
import { logActivity } from "../activity";
import { notifyMentions } from "../comments";
import { createOpportunity } from "../opportunities";

export type PackDecision = "merge" | "create" | "skip";
type Rec = { entityType: string; entityId: string; action: "created" | "merged" };

export function parsePack(raw: unknown): Pack {
  return PackSchema.parse(raw);
}

/** Match each pack account to an existing one: domain first, then normalized legal name (same rules as imports). */
export async function planPack(pack: Pack) {
  const existing = await db.account.findMany({ select: { id: true, name: true, domain: true } });
  const byDomain = new Map(existing.filter((a) => a.domain).map((a) => [a.domain!.toLowerCase(), a]));
  const byName = new Map(existing.map((a) => [normalizeLegalName(a.name), a]));
  return pack.accounts.map((p) => {
    const d = p.identity.domain ? normalizeDomain(p.identity.domain) : null;
    const match = (d && byDomain.get(d)) || byName.get(normalizeLegalName(p.identity.name)) || null;
    return {
      ref: p.ref,
      name: p.identity.name,
      domain: d,
      match: match ? { id: match.id, name: match.name, by: d && byDomain.get(d) ? "domain" : "name" } : null,
      decision: (match ? "merge" : "create") as PackDecision,
      counts: {
        fields: p.fields?.length ?? 0,
        initiatives: p.initiatives?.length ?? 0,
        techStack: p.techStack?.length ?? 0,
        contacts: p.contacts?.length ?? 0,
        opportunities: p.opportunities?.length ?? 0,
        notes: p.notes?.length ?? 0,
        comments: p.comments?.length ?? 0,
      },
    };
  });
}

async function createAccount(p: PackAccount) {
  const i = p.identity;
  const tier: Tier = (TIERS as readonly string[]).includes(p.tier ?? "") ? (p.tier as Tier) : "Growth";
  return db.account.create({
    data: {
      name: i.name, domain: i.domain ? normalizeDomain(i.domain) : null, ticker: i.ticker ? normalizeTicker(i.ticker) : null,
      cik: i.cik ?? null, lei: i.lei ?? null, wikidataId: i.wikidataId ?? null, fiscalYearEnd: i.fiscalYearEnd ?? null,
      industry: i.industry || "Unclassified", subIndustry: i.subIndustry ?? null, hq: i.hq ?? null,
      employeeBand: i.employeeBand ?? null, revenueBand: i.revenueBand ?? null, tier, isDemo: false,
      sourceConfig: { googleNews: false, rssFeeds: [] },
      practiceStatus: { create: DEFAULT_PRACTICE_AREAS.map((x) => ({ practiceArea: x.id, status: "NotEngaged" })) },
    },
  });
}

/** Everything in one pack account, attached to `accountId`. Duplicates (same title/technology/name) are skipped. */
async function importChildren(p: PackAccount, accountId: string, author: string, recs: Rec[], users: { id: string; displayName: string }[]) {
  const acc = { isDemo: false };
  const add = (entityType: string, entityId: string) => recs.push({ entityType, entityId, action: "created" });
  const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  if (p.fields?.length) {
    const current = new Map((await db.accountField.findMany({ where: { accountId } })).map((f) => [f.field, JSON.stringify(f.value)]));
    for (const f of p.fields) {
      if (current.get(f.field) === JSON.stringify(f.value)) continue;
      const r = await db.fieldProposal.create({
        data: {
          accountId, field: f.field, value: (f.value ?? null) as Prisma.InputJsonValue, enricherId: "pack",
          source: `Pack from ${author} · ${f.source}`, sourceUrl: f.sourceUrl ?? "", confidence: proposalConfidence(f.confidence),
          fetchedAt: f.fetchedAt ? new Date(f.fetchedAt) : new Date(),
        },
      });
      add("proposal", r.id);
    }
  }
  const [inits, techs, contacts, opps] = await Promise.all([
    db.initiative.findMany({ where: { accountId }, select: { title: true } }),
    db.techStackHypothesis.findMany({ where: { accountId }, select: { technology: true } }),
    db.contact.findMany({ where: { accountId }, select: { title: true, displayName: true } }),
    db.opportunity.findMany({ where: { accountId }, select: { id: true, name: true } }),
  ]);
  const haveInit = new Set(inits.map((x) => lc(x.title)));
  for (const i of p.initiatives ?? []) {
    if (haveInit.has(lc(i.title))) continue;
    // A teammate's item without a public link stays a hypothesis (never presented as fact).
    const source = intelPolicyViolation(acc, i) ? "user-hypothesis" : i.source;
    const r = await db.initiative.create({ data: { accountId, title: i.title, description: i.description ?? null, practiceAreas: i.practiceAreas, evidence: i.evidence ?? null, section: i.section ?? null, source, sourceUrl: i.sourceUrl ?? null, confidence: i.confidence } });
    haveInit.add(lc(i.title));
    add("initiative", r.id);
  }
  const haveTech = new Set(techs.map((x) => lc(x.technology)));
  for (const t of p.techStack ?? []) {
    if (haveTech.has(lc(t.technology))) continue;
    const source = intelPolicyViolation(acc, t) ? "user-hypothesis" : t.source;
    const r = await db.techStackHypothesis.create({ data: { accountId, category: t.category, technology: t.technology, evidence: t.evidence, source, sourceUrl: t.sourceUrl ?? null, confidence: t.confidence, status: t.status } });
    haveTech.add(lc(t.technology));
    add("tech", r.id);
  }
  const haveContact = new Set(contacts.map((c) => lc(c.displayName) || `title:${lc(c.title)}`));
  for (const c of p.contacts ?? []) {
    const k = lc(c.displayName) || `title:${lc(c.title)}`;
    if (haveContact.has(k)) continue;
    const r = await db.contact.create({ data: { accountId, title: c.title, function: c.function, seniority: c.seniority, buyingRole: c.buyingRole, engagement: c.engagement, displayName: c.displayName ?? null, source: c.source ?? null, sourceUrl: c.sourceUrl ?? null } });
    haveContact.add(k);
    add("contact", r.id);
  }
  const oppIds = new Map<string, string>();
  const haveOpp = new Map(opps.map((o) => [lc(o.name), o.id]));
  for (const o of p.opportunities ?? []) {
    const existing = haveOpp.get(lc(o.name));
    if (existing) { oppIds.set(o.ref, existing); continue; }
    const stage = (STAGES as readonly string[]).includes(o.stage) ? (o.stage as Stage) : "Discover";
    const created = await createOpportunity({ accountId, name: o.name, practiceArea: o.practiceArea, stage, amount: o.amount ?? 0, closeDate: new Date(o.closeDate), nextStep: o.nextStep ?? null }, { quiet: true });
    await db.opportunity.update({
      where: { id: created.id },
      data: {
        nextStepDate: o.nextStepDate ? new Date(o.nextStepDate) : null, partners: o.partners,
        ...(o.meddpicc ? { meddpicc: o.meddpicc as Prisma.InputJsonValue } : {}), ...(o.competitors ? { competitors: o.competitors } : {}),
      },
    });
    oppIds.set(o.ref, created.id);
    add("opportunity", created.id);
  }
  const noteBodies = new Set((await db.note.findMany({ where: { entityType: "account", entityId: accountId }, select: { body: true } })).map((n) => n.body));
  for (const n of p.notes ?? []) {
    const body = `${n.body}\n\n— from ${author}'s pack`;
    if (noteBodies.has(body) || noteBodies.has(n.body)) continue;
    const r = await db.note.create({ data: { entityType: "account", entityId: accountId, body, internalOnly: true } });
    noteBodies.add(body);
    add("note", r.id);
  }
  const accName = (await db.account.findUnique({ where: { id: accountId }, select: { name: true } }))?.name ?? "an account";
  const seen = new Set((await db.comment.findMany({ where: { accountId }, select: { body: true, createdAt: true } })).map((c) => `${c.createdAt.toISOString()}|${c.body}`));
  for (const c of p.comments ?? []) {
    const onOpp = c.oppRef ? oppIds.get(c.oppRef) : undefined;
    if ((c.oppRef && !onOpp) || seen.has(`${new Date(c.createdAt).toISOString()}|${c.body}`)) continue;
    const mentions = findMentions(c.mentionNames.map((n) => `@${n}`).join(" "), users);
    const r = await db.comment.create({
      data: { entityType: onOpp ? "opportunity" : "account", entityId: onOpp ?? accountId, accountId, body: c.body, mentions, authorId: `pack:${c.authorName}`, authorName: c.authorName, createdAt: new Date(c.createdAt) },
    });
    await notifyMentions(mentions, c.authorName, { label: accName, href: onOpp ? `/opportunities?focus=${onOpp}` : `/accounts/${accountId}#comments` });
    add("comment", r.id);
  }
}

/** Import a pack as one undoable batch (Import → History). Field values arrive as proposals to review. */
export async function commitPack(pack: Pack, decisions: Record<string, PackDecision>, fileName?: string) {
  await ensureLocalUser();
  const plan = await planPack(pack);
  const users = await db.user.findMany({ select: { id: true, displayName: true } });
  const recs: Rec[] = [];
  const touched = new Set<string>();
  const counts = { created: 0, merged: 0, skipped: 0, errors: 0 };
  for (const row of plan) {
    const decision = decisions[row.ref] ?? row.decision;
    const p = pack.accounts.find((a) => a.ref === row.ref)!;
    if (decision === "skip" || (decision === "merge" && !row.match)) { counts.skipped++; continue; }
    let accountId: string;
    if (decision === "create") {
      const a = await createAccount(p);
      recs.push({ entityType: "account", entityId: a.id, action: "created" });
      accountId = a.id;
      counts.created++;
    } else {
      accountId = row.match!.id;
      counts.merged++;
    }
    await importChildren(p, accountId, pack.createdBy.name, recs, users);
    touched.add(accountId);
  }
  const batch = await db.importBatch.create({
    data: { kind: "pack", fileName: fileName ?? `${pack.title}.json`, inputType: "pack", counts, records: { create: recs.map((r) => ({ entityType: r.entityType, entityId: r.entityId, action: r.action })) } },
  });
  if (touched.size) await computeScoresForAccounts(db, { now: new Date(), accountIds: [...touched] });
  const summary = `Imported pack “${pack.title}” from ${pack.createdBy.name}: ${counts.created} new, ${counts.merged} merged, ${counts.skipped} skipped`;
  await logActivity({ entityType: "import", entityId: batch.id, action: "pack.imported", summary, diff: counts });
  await audit(db, { action: "pack.import", entityType: "import", entityId: batch.id, summary, meta: { ...counts, items: recs.length } });
  return { batchId: batch.id, counts, items: recs.length, accountIds: [...touched] };
}
