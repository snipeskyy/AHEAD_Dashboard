import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { matches, RulesSchema, SMART_ENTITIES, type Rules, type SmartEntity } from "@/lib/daily/smart-lists";
import { listAccounts } from "./accounts";
import { enrichmentOverview } from "./enrichment";
import { listOpportunities } from "./opportunities";
import { querySignalsByIds } from "./signals";

export const SmartListBody = z.object({
  name: z.string().trim().min(2).max(80),
  entity: z.enum(SMART_ENTITIES),
  rules: RulesSchema,
  pinned: z.boolean().default(true),
});

type Row = Record<string, unknown> & { id: string; href: string; title: string; sub: string };

/** Flat, rule-friendly rows for an entity. Accounts and opps are small; signals are capped to 90 days / 5,000. */
async function rowsFor(entity: SmartEntity): Promise<Row[]> {
  if (entity === "account") {
    const [accs, inits, opps, ov, ids] = await Promise.all([
      listAccounts(),
      db.initiative.findMany({ select: { accountId: true, practiceAreas: true } }),
      db.opportunity.findMany({ where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } }, select: { accountId: true, practiceArea: true } }),
      enrichmentOverview(),
      db.account.findMany({ select: { id: true, identityConfirmedAt: true, fiscalYearEnd: true } }),
    ]);
    const ip = new Map<string, Set<string>>();
    for (const i of inits) for (const p of i.practiceAreas as string[]) ip.set(i.accountId, (ip.get(i.accountId) ?? new Set()).add(p));
    const op = new Map<string, Set<string>>();
    for (const o of opps) op.set(o.accountId, (op.get(o.accountId) ?? new Set()).add(o.practiceArea));
    const comp = new Map(ov.map((o) => [o.accountId, o.completeness]));
    const meta = new Map(ids.map((a) => [a.id, a]));
    return accs.map((a) => ({
      ...a,
      openOpps: a.openOpps,
      initiativePractices: [...(ip.get(a.id) ?? [])],
      openOppPractices: [...(op.get(a.id) ?? [])],
      completeness: comp.get(a.id) ?? 0,
      identityConfirmed: !!meta.get(a.id)?.identityConfirmedAt,
      hasFiscalYearEnd: !!meta.get(a.id)?.fiscalYearEnd,
      href: `/accounts/${a.id}`,
      title: a.name,
      sub: `${a.tier} · ${a.industry}`,
    }));
  }
  if (entity === "opportunity")
    return (await listOpportunities()).map((o) => ({ ...o, href: `/opportunities?focus=${o.id}`, title: o.name, sub: `${o.accountName} · ${o.stage}` }));
  const ids = await db.signal.findMany({ where: { publishedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, orderBy: { publishedAt: "desc" }, take: 5000, select: { id: true, triagedAt: true } });
  const triaged = new Map(ids.map((s) => [s.id, !!s.triagedAt]));
  return (await querySignalsByIds(ids.map((s) => s.id))).map((s) => ({ ...s, triaged: triaged.get(s.id) ?? false, href: `/signals?focus=${s.id}`, title: s.title, sub: `${s.accountName} · ${s.type}` }));
}

export async function evaluate(entity: SmartEntity, rules: Rules, limit = 500) {
  const now = new Date();
  const all = await rowsFor(entity);
  const hits = all.filter((r) => matches(r, rules, now));
  return { total: hits.length, of: all.length, items: hits.slice(0, limit).map((r) => ({ id: r.id, href: r.href, title: r.title, sub: r.sub })) };
}
