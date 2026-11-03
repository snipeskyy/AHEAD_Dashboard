"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useModuleSettings } from "@/hooks/use-module-settings";
import { api } from "@/lib/api-client";
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
import { PRACTICE_AREA_IDS } from "@/config/practice-areas";
import { OPEN_STAGES } from "@/lib/domain/enums";
import type { OppRow, PipelineOpp, StageEvent } from "@/lib/pipeline/types";

export const toPipelineOpp = (r: OppRow): PipelineOpp => ({
  stage: r.stage,
  amount: r.amount,
  probability: r.probability,
  forecastCategory: r.forecastCategory,
  closeDate: new Date(r.closeDate),
  createdAt: new Date(r.createdAt),
  closedAt: r.closedAt ? new Date(r.closedAt) : null,
  stageChangedAt: new Date(r.stageChangedAt),
  practiceArea: r.practiceArea,
});

export function useStageEvents() {
  return useQuery({
    queryKey: ["opportunities", "stage-events"],
    queryFn: () =>
      api<{ items: Array<Omit<StageEvent, "changedAt"> & { changedAt: string }> }>(
        "/api/opportunities/stage-events",
      ).then((r) => r.items.map((e) => ({ ...e, changedAt: new Date(e.changedAt) }))),
  });
}

/** All pipeline analytics computed from the (filtered) rows, so one filter row drives every view. */
export function usePipelineAnalytics(rows: OppRow[], events: StageEvent[] | undefined) {
  const settings = useModuleSettings<{
    quarterlyTarget: number;
    coverageTarget: number;
    stalledDays: number;
  }>("opportunities");
  return useMemo(() => {
    const now = new Date();
    const opps = rows.map(toPipelineOpp);
    const open = opps.filter((o) => (OPEN_STAGES as readonly string[]).includes(o.stage));
    const ids = new Set(rows.map((r) => r.id));
    const ev = (events ?? []).filter((e) => ids.has(e.opportunityId));
    return {
      settings,
      kpis: computeKpis(opps, now, settings.quarterlyTarget, settings.coverageTarget),
      months: computeForecast(opps, "month", nextPeriods(now, "month", 9, -3)),
      quarters: computeForecast(opps, "quarter", nextPeriods(now, "quarter", 5, -1)),
      byStage: pipelineByStage(open),
      byPractice: pipelineByPractice(open, PRACTICE_AREA_IDS),
      conversion: stageConversion(ev),
      velocity: stageVelocity(ev, now),
      aging: pipelineAging(open, now),
      creation: pipelineCreationTrend(opps, now, 12),
    };
  }, [rows, events, settings]);
}
