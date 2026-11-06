import "server-only";
import type { PrismaClient } from "@prisma/client";
import { BUYING_ROLE_LABELS, type BuyingRole, type Meddpicc } from "@/lib/domain/enums";
import { planningWindow } from "@/lib/daily/fiscal";
import { suggestQuestions } from "@/lib/daily/questions";
import { committeeGaps } from "@/lib/intel/committee";
import { meddpiccCompleteness } from "@/lib/scoring/meddpicc";
import { HttpError } from "./http";
import { recommendForAccount } from "./plays";
import { territoryConfig } from "./territory";

/** One-page meeting prep brief (data). Used by the brief page and the "Meeting prep brief" export section. */
export async function buildBrief(db: PrismaClient, accountId: string, now = new Date()) {
  const a = await db.account.findUnique({
    where: { id: accountId },
    include: {
      contacts: true,
      initiatives: { orderBy: { confidence: "desc" }, take: 5 },
      signals: { where: { dismissed: false }, orderBy: { publishedAt: "desc" }, take: 5 },
      opportunities: { where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } }, orderBy: { closeDate: "asc" } },
      touches: { where: { completedAt: { not: null } }, orderBy: { completedAt: "desc" }, take: 3 },
      fields: { where: { field: { in: ["firmographics.description", "firmographics.ceo"] } } },
      meetings: { where: { startsAt: { gte: new Date(now.getTime() - 3_600_000) } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });
  if (!a) throw new HttpError(404, "Account not found");
  const { planning } = await territoryConfig();
  const fw = planningWindow(a.fiscalYearEnd, now, planning);
  const gaps = committeeGaps(a.contacts);
  const missingRoles = gaps.map((g) => g.role).filter((r): r is BuyingRole => !!r);
  const opps = a.opportunities.map((o) => ({
    id: o.id, name: o.name, stage: o.stage, amount: o.amount, closeDate: o.closeDate.toISOString(),
    nextStep: o.nextStep, nextStepDate: o.nextStepDate?.toISOString() ?? null,
    meddpiccScore: meddpiccCompleteness(o.meddpicc as Meddpicc),
  }));
  const plays = await recommendForAccount(accountId, 3).catch(() => null);
  const field = (k: string) => a.fields.find((f) => f.field === k)?.value as string | undefined;
  const exec = a.signals.find((s) => s.type === "exec-change") ?? null;
  return {
    account: {
      id: a.id, name: a.name, tier: a.tier, industry: a.industry, hq: a.hq, domain: a.domain, ticker: a.ticker,
      healthScore: Math.round(a.healthScore), whitespaceScore: Math.round(a.whitespaceScore),
      description: field("firmographics.description") ?? null, ceo: field("firmographics.ceo") ?? null,
      employeeBand: a.employeeBand, revenueBand: a.revenueBand,
    },
    meeting: a.meetings[0] ? { title: a.meetings[0].title, startsAt: a.meetings[0].startsAt.toISOString() } : null,
    fiscal: fw ? { label: fw.label, phase: fw.phase } : null,
    signals: a.signals.map((s) => ({ id: s.id, title: s.title, type: s.type, publishedAt: s.publishedAt.toISOString(), url: s.url, source: s.source })),
    opps,
    committee: {
      contacts: a.contacts.map((c) => ({ name: c.displayName, title: c.title, role: BUYING_ROLE_LABELS[c.buyingRole as BuyingRole] ?? c.buyingRole, engagement: c.engagement })),
      gaps: gaps.map((g) => g.message),
    },
    touches: a.touches.map((t) => ({ channel: t.channel, persona: t.persona, angle: t.angle, outcome: t.outcome, completedAt: t.completedAt!.toISOString() })),
    initiatives: a.initiatives.map((i) => ({ title: i.title, practiceAreas: i.practiceAreas as string[], evidence: i.evidence, section: i.section, sourceUrl: i.sourceUrl, source: i.source })),
    plays: (plays?.items ?? []).map((r) => ({ name: r.play.name, score: Math.round(r.score), reasons: r.reasons.map((x) => x.text) })),
    questions: suggestQuestions({
      initiatives: a.initiatives.map((i) => ({ title: i.title, practiceAreas: i.practiceAreas as string[] })),
      missingRoles,
      fiscalLabel: fw?.label ?? null,
      fiscalPhase: fw?.phase ?? null,
      opps,
      execChange: exec ? { title: exec.title } : null,
    }),
    generatedAt: now.toISOString(),
  };
}
export type Brief = Awaited<ReturnType<typeof buildBrief>>;
