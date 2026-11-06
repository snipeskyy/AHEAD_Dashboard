import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export const RepBody = z.object({
  partnerCompany: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(120).nullish(),
  territory: z.string().trim().max(120).nullish(),
  notes: z.string().max(4000).nullish(),
  accountIds: z.array(z.string()).max(500).optional(),
});

export const RegistrationBody = z.object({
  partnerCompany: z.string().trim().min(2).max(120),
  repId: z.string().nullish(),
  accountId: z.string(),
  opportunityId: z.string().nullish(),
  reference: z.string().trim().max(120).nullish(),
  status: z.enum(["submitted", "approved", "rejected", "expired"]).default("submitted"),
  expiresAt: z.coerce.date().nullish(),
  notes: z.string().max(2000).nullish(),
});

const OPEN = { notIn: ["ClosedWon", "ClosedLost"] };
const key = (s: string) => s.trim().toLowerCase();

/**
 * Co-sell view per partner company (all user-entered): reps, accounts they cover, shared open pipeline
 * (deals the reps are on, or that list the partner), open registrations and the last joint touch.
 */
export async function partnerOverview(now = new Date()) {
  const [reps, regs, opps] = await Promise.all([
    db.partnerRep.findMany({
      include: {
        accounts: { include: { account: { select: { id: true, name: true } } } },
        opportunities: { include: { opportunity: { select: { id: true, name: true, amount: true, stage: true, accountId: true } } } },
      },
      orderBy: [{ partnerCompany: "asc" }, { name: "asc" }],
    }),
    db.partnerRegistration.findMany({
      include: { account: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, rep: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.opportunity.findMany({ where: { stage: OPEN }, select: { id: true, name: true, amount: true, partners: true, accountId: true } }),
  ]);
  const touches = await db.touch.findMany({
    where: { partnerRepId: { in: reps.map((r) => r.id) }, completedAt: { not: null } },
    select: { partnerRepId: true, completedAt: true },
  });
  const lastByRep = new Map<string, Date>();
  for (const t of touches) {
    const prev = lastByRep.get(t.partnerRepId!);
    if (!prev || t.completedAt! > prev) lastByRep.set(t.partnerRepId!, t.completedAt!);
  }
  const companies = new Map<string, string>();
  for (const r of reps) companies.set(key(r.partnerCompany), r.partnerCompany);
  for (const g of regs) companies.set(key(g.partnerCompany), g.partnerCompany);
  for (const o of opps) for (const p of o.partners as string[]) if (!companies.has(key(p))) companies.set(key(p), p);

  return [...companies.entries()].map(([k, name]) => {
    const cr = reps.filter((r) => key(r.partnerCompany) === k);
    const repOppIds = new Set(cr.flatMap((r) => r.opportunities.filter((x) => !["ClosedWon", "ClosedLost"].includes(x.opportunity.stage)).map((x) => x.opportunity.id)));
    const shared = opps.filter((o) => repOppIds.has(o.id) || (o.partners as string[]).some((p) => key(p) === k));
    const cregs = regs.filter((g) => key(g.partnerCompany) === k);
    const last = cr.map((r) => lastByRep.get(r.id)).filter((d): d is Date => !!d).sort((a, b) => +b - +a)[0] ?? null;
    return {
      company: name,
      reps: cr.map((r) => ({
        id: r.id, name: r.name, title: r.title, territory: r.territory, notes: r.notes,
        accounts: r.accounts.map((a) => a.account),
        opportunities: r.opportunities.map((o) => o.opportunity),
        lastJointTouch: lastByRep.get(r.id)?.toISOString() ?? null,
      })),
      sharedPipeline: shared.reduce((s, o) => s + o.amount, 0),
      sharedOpps: shared.length,
      registrations: cregs.map((g) => ({ ...g, expired: g.status === "expired" || (!!g.expiresAt && g.expiresAt < now) })),
      openRegistrations: cregs.filter((g) => (g.status === "submitted" || g.status === "approved") && !(g.expiresAt && g.expiresAt < now)).length,
      lastJointTouch: last?.toISOString() ?? null,
    };
  }).sort((a, b) => b.sharedPipeline - a.sharedPipeline || a.company.localeCompare(b.company));
}

/** Reps engaged on one account, with the deals they're on there. */
export async function accountPartners(accountId: string) {
  const reps = await db.partnerRep.findMany({
    where: { OR: [{ accounts: { some: { accountId } } }, { opportunities: { some: { opportunity: { accountId } } } }] },
    include: { opportunities: { where: { opportunity: { accountId } }, include: { opportunity: { select: { id: true, name: true, stage: true } } } } },
    orderBy: { partnerCompany: "asc" },
  });
  const regs = await db.partnerRegistration.findMany({ where: { accountId }, include: { opportunity: { select: { id: true, name: true } } } });
  return {
    reps: reps.map((r) => ({ id: r.id, name: r.name, title: r.title, partnerCompany: r.partnerCompany, opportunities: r.opportunities.map((o) => o.opportunity) })),
    registrations: regs,
  };
}
