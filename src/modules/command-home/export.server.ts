import "server-only";
import { money, pct, day } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import { computeKpis } from "@/lib/pipeline/analytics";
import { getModuleSettings } from "@/lib/settings/server";

export const builders: SectionBuilders = {
  "command-home.kpis": async (ctx) => {
    const opps = await ctx.db.opportunity.findMany({
      where: { accountId: { in: ctx.accounts.map((a) => a.id) } },
      select: {
        stage: true,
        amount: true,
        probability: true,
        forecastCategory: true,
        closeDate: true,
        createdAt: true,
        closedAt: true,
        stageChangedAt: true,
        practiceArea: true,
      },
    });
    const s = await getModuleSettings<{ quarterlyTarget: number; coverageTarget: number }>(
      "opportunities",
    );
    const k = computeKpis(opps, ctx.now, s.quarterlyTarget, s.coverageTarget);
    return [
      {
        kind: "kv",
        items: [
          { label: "Pipeline", value: money(k.pipelineTotal), field: "pipelineTotal" },
          {
            label: "Weighted pipeline",
            value: money(k.weightedPipeline),
            field: "weightedPipeline",
          },
          { label: "Active opportunities", value: String(k.activeOpps), field: "activeOpps" },
          {
            label: "Win rate (12 months)",
            value: k.winRate === null ? "—" : pct(k.winRate),
            field: "winRate",
          },
          {
            label: "Average deal cycle",
            value: k.avgCycleDays === null ? "—" : `${Math.round(k.avgCycleDays)} days`,
            field: "avgCycle",
          },
        ],
      },
    ];
  },
  "command-home.whats-changed": async (ctx) => {
    const since = new Date(ctx.now.getTime() - 7 * 86_400_000);
    const accountIds = ctx.accounts.map((a) => a.id);
    const oppIds = (
      await ctx.db.opportunity.findMany({
        where: { accountId: { in: accountIds } },
        select: { id: true },
      })
    ).map((o) => o.id);
    const acts = await ctx.db.activityLog.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { entityType: "account", entityId: { in: accountIds } },
          { entityType: "opportunity", entityId: { in: oppIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    if (!acts.length)
      return [
        { kind: "paragraph", text: "No recorded changes in the last 7 days.", field: "changes" },
      ];
    return [
      {
        kind: "list",
        field: "changes",
        items: acts.map((a) => ({ text: a.summary, sub: day(a.createdAt) })),
      },
    ];
  },
};
