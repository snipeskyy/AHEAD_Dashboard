import "server-only";
import { day, money, perAccount } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import type { Block } from "@/lib/export/types";

const OPEN = ["ClosedWon", "ClosedLost"];

/** Partner co-sell brief: all user-entered (reps, the deals they're on, registrations, joint touches). */
export const builders: SectionBuilders = {
  "partners.co-sell": (ctx) =>
    perAccount(ctx, async (acc) => {
      const [reps, regs, touches, opps] = await Promise.all([
        ctx.db.partnerRep.findMany({
          where: { OR: [{ accounts: { some: { accountId: acc.id } } }, { opportunities: { some: { opportunity: { accountId: acc.id } } } }] },
          include: { opportunities: { where: { opportunity: { accountId: acc.id } }, include: { opportunity: { select: { name: true, stage: true, amount: true } } } } },
          orderBy: { partnerCompany: "asc" },
        }),
        ctx.db.partnerRegistration.findMany({ where: { accountId: acc.id }, include: { opportunity: { select: { name: true } } } }),
        ctx.db.touch.findMany({ where: { accountId: acc.id, partnerRepId: { not: null }, completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 5}),
        ctx.db.opportunity.findMany({ where: { accountId: acc.id, stage: { notIn: OPEN } }, select: { name: true, stage: true, amount: true, partners: true } }),
      ]);
      const touchReps = new Map(
        (await ctx.db.partnerRep.findMany({ where: { id: { in: touches.map((t) => t.partnerRepId!).filter(Boolean) } }, select: { id: true, name: true, partnerCompany: true } })).map((r) => [r.id, r]),
      );
      const companies = new Set([...reps.map((r) => r.partnerCompany), ...opps.flatMap((o) => (o.partners as string[]) ?? [])]);
      if (!companies.size) return [{ kind: "paragraph", field: "reps", text: "No partners recorded on this account yet (Partners → Add rep, or list partners on a deal)." }];
      const shared = opps.filter((o) => ((o.partners as string[]) ?? []).length || reps.some((r) => r.opportunities.some((x) => x.opportunity.name === o.name)));
      const blocks: Block[] = [
        {
          kind: "kv",
          field: "deals",
          items: [
            { label: "Partners engaged", value: String(companies.size) },
            { label: "Shared open deals", value: String(shared.length) },
            { label: "Shared pipeline", value: money(shared.reduce((s, o) => s + o.amount, 0)) },
            { label: "Open registrations", value: String(regs.filter((g) => g.status === "submitted" || g.status === "approved").length), field: "registrations" },
          ],
        },
      ];
      if (reps.length)
        blocks.push({
          kind: "table",
          field: "reps",
          caption: "Partner reps engaged here",
          columns: [
            { key: "company", label: "Partner" },
            { key: "rep", label: "Rep" },
            { key: "deals", label: "Deals" },
          ],
          rows: reps.map((r) => ({
            company: { text: r.partnerCompany },
            rep: { text: [r.name, r.title].filter(Boolean).join(", ") },
            deals: { text: r.opportunities.map((x) => x.opportunity.name).join("; ") || "—" },
          })),
        });
      if (regs.length)
        blocks.push({
          kind: "table",
          field: "registrations",
          caption: "Deal registrations",
          columns: [
            { key: "p", label: "Partner" },
            { key: "ref", label: "Reference" },
            { key: "deal", label: "Deal" },
            { key: "st", label: "Status" },
            { key: "exp", label: "Expires" },
          ],
          rows: regs.map((g) => ({
            p: { text: g.partnerCompany },
            ref: { text: g.reference ?? "—" },
            deal: { text: g.opportunity?.name ?? "—" },
            st: { text: g.status },
            exp: { text: g.expiresAt ? day(g.expiresAt) : "—" },
          })),
        });
      if (touches.length)
        blocks.push({
          kind: "list",
          field: "touches",
          items: touches.map((t) => ({ text: `${t.channel} with ${t.persona}`, sub: [touchReps.get(t.partnerRepId!) ? `${touchReps.get(t.partnerRepId!)!.name} (${touchReps.get(t.partnerRepId!)!.partnerCompany})` : null, t.completedAt ? day(t.completedAt) : null].filter(Boolean).join(" · ") })),
        });
      return blocks;
    }),
};
