import "server-only";
import { currentUser } from "@/lib/auth/server";
import { roleById } from "@/config/roles";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { effectiveSections, PACK_FORMAT, PACK_VERSION, type Pack, type PackAccount, type PackSection } from "@/lib/team/pack-schema";
import { HttpError } from "../http";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Build a pack for the chosen accounts and sections. Role gating applies (you can't share what you can't see). */
export async function buildPack(input: { accountIds: string[]; sections: string[]; title?: string }): Promise<Pack> {
  const me = await currentUser();
  const sections = effectiveSections(input.sections, me.role);
  const has = (s: PackSection) => sections.includes(s);
  const accounts = await db.account.findMany({
    where: { id: { in: input.accountIds } },
    include: {
      fields: has("profile"),
      initiatives: has("evidence"),
      techStack: has("evidence") ? { where: { status: { not: "rejected" } } } : false,
      contacts: has("contacts"),
      opportunities: has("opportunities"),
    },
    orderBy: { name: "asc" },
  });
  if (!accounts.length) throw new HttpError(400, "Choose at least one account");
  if (accounts.some((a) => a.isDemo)) throw new HttpError(400, "Demo (test) accounts can't be shared in a pack");

  const ids = accounts.map((a) => a.id);
  const oppIds = accounts.flatMap((a) => a.opportunities?.map((o) => o.id) ?? []);
  const [notes, comments] = await Promise.all([
    has("notes") ? db.note.findMany({ where: { entityType: "account", entityId: { in: ids } }, orderBy: { createdAt: "asc" } }) : [],
    has("comments")
      ? db.comment.findMany({ where: { OR: [{ entityType: "account", entityId: { in: ids } }, ...(oppIds.length ? [{ entityType: "opportunity", entityId: { in: oppIds } }] : [])] }, orderBy: { createdAt: "asc" } })
      : [],
  ]);
  const users = new Map((await db.user.findMany({ select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
  const oppAccount = new Map(accounts.flatMap((a) => (a.opportunities ?? []).map((o) => [o.id, a.id] as const)));

  const out: PackAccount[] = accounts.map((a) => ({
    ref: a.id,
    identity: {
      name: a.name, domain: a.domain, ticker: a.ticker, cik: a.cik, lei: a.lei, wikidataId: a.wikidataId,
      fiscalYearEnd: a.fiscalYearEnd, industry: a.industry, subIndustry: a.subIndustry, hq: a.hq,
      employeeBand: a.employeeBand, revenueBand: a.revenueBand,
    },
    tier: has("tier") ? a.tier : null,
    fields: a.fields?.map((f) => ({ field: f.field, value: f.value, source: f.source, sourceUrl: f.sourceUrl, confidence: f.confidence, fetchedAt: iso(f.fetchedAt) })),
    initiatives: a.initiatives?.map((i) => ({
      title: i.title, description: i.description, practiceAreas: (i.practiceAreas as string[]) ?? [], evidence: i.evidence, section: i.section,
      source: i.source, sourceUrl: i.sourceUrl, confidence: i.confidence,
    })),
    techStack: a.techStack?.map((t) => ({ category: t.category, technology: t.technology, evidence: t.evidence, source: t.source, sourceUrl: t.sourceUrl, confidence: t.confidence, status: t.status })),
    contacts: a.contacts?.map((c) => ({
      title: c.title, function: c.function, seniority: c.seniority, buyingRole: c.buyingRole, engagement: c.engagement,
      displayName: has("contactNames") ? c.displayName : null, source: c.source, sourceUrl: c.sourceUrl,
    })),
    opportunities: a.opportunities?.map((o) => ({
      ref: o.id, name: o.name, practiceArea: o.practiceArea, stage: o.stage, closeDate: o.closeDate.toISOString(),
      nextStep: o.nextStep, nextStepDate: iso(o.nextStepDate), partners: (o.partners as string[]) ?? [],
      ...(has("amounts") ? { amount: o.amount, meddpicc: o.meddpicc, competitors: (o.competitors as string[]) ?? [] } : {}),
    })),
    notes: has("notes") ? notes.filter((n) => n.entityId === a.id).map((n) => ({ body: n.body, createdAt: n.createdAt.toISOString() })) : undefined,
    comments: has("comments")
      ? comments
          .filter((c) => (c.entityType === "account" ? c.entityId === a.id : oppAccount.get(c.entityId) === a.id))
          .map((c) => ({
            body: c.body,
            authorName: users.get(c.authorId) ?? c.authorName ?? "Unknown",
            mentionNames: (c.mentions as string[]).map((id) => users.get(id)).filter((n): n is string => !!n),
            createdAt: c.createdAt.toISOString(),
            oppRef: c.entityType === "opportunity" ? c.entityId : null,
          }))
      : undefined,
  }));

  const title = input.title?.trim() || (accounts.length === 1 ? accounts[0].name : `${accounts.length} accounts`);
  await audit(db, {
    action: "pack.export",
    entityType: "pack",
    summary: `Exported pack “${title}” (${accounts.length} account${accounts.length === 1 ? "" : "s"}; ${sections.join(", ")})`,
    meta: { accountIds: ids, sections },
  });
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    title,
    createdAt: new Date().toISOString(),
    createdBy: { name: me.displayName, role: roleById(me.role).label },
    sections,
    accounts: out,
  };
}
