import { PRACTICE_AREA_IDS } from "@/config/practice-areas";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/enums";
import {
  computeForecast,
  computeKpis,
  nextPeriods,
  pipelineAging,
  pipelineByPractice,
  pipelineByStage,
  pipelineCreationTrend,
  stageConversion,
  stageVelocity,
} from "@/lib/pipeline/analytics";
import { getModuleSettings } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/** Portfolio pipeline summary: KPIs, forecast, and analytics. Optional ?accountId= scope. */
export const GET = handler(async (req: Request) => {
  const accountId = new URL(req.url).searchParams.get("accountId") ?? undefined;
  const now = new Date();
  const [opps, events, settings] = await Promise.all([
    db.opportunity.findMany({
      where: { accountId },
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
    }),
    db.stageChange.findMany({
      where: accountId ? { opportunity: { accountId } } : {},
      select: { opportunityId: true, fromStage: true, toStage: true, changedAt: true },
    }),
    getModuleSettings<{ quarterlyTarget: number; coverageTarget: number }>("opportunities"),
  ]);
  const open = opps.filter((o) => (OPEN_STAGES as readonly string[]).includes(o.stage));
  const months = nextPeriods(now, "month", 9, -3);
  const quarters = nextPeriods(now, "quarter", 5, -1);
  return json({
    kpis: computeKpis(opps, now, settings.quarterlyTarget, settings.coverageTarget),
    targets: { quarterly: settings.quarterlyTarget, monthly: settings.quarterlyTarget / 3 },
    forecast: {
      months: computeForecast(opps, "month", months),
      quarters: computeForecast(opps, "quarter", quarters),
    },
    byStage: pipelineByStage(open),
    byPractice: pipelineByPractice(open, PRACTICE_AREA_IDS),
    conversion: stageConversion(events),
    velocity: stageVelocity(events, now),
    aging: pipelineAging(open, now),
    creation: pipelineCreationTrend(opps, now, 12),
  });
});
