import { z } from "zod";
import { clamp01, round1, type ScoreBreakdown, type ScoreComponent } from "./types";

export const HealthWeightsSchema = z.object({
  engagement: z.number().min(0),
  coverage: z.number().min(0),
  momentum: z.number().min(0),
  signals: z.number().min(0),
  quality: z.number().min(0),
  risk: z.number().min(0),
});
export type HealthWeights = z.infer<typeof HealthWeightsSchema>;

export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  engagement: 0.25,
  coverage: 0.2,
  momentum: 0.15,
  signals: 0.1,
  quality: 0.15,
  risk: 0.15,
};

export interface HealthInputs {
  daysSinceLastTouch: number | null;
  /** Count of core buying roles (EB, Champion, Technical, Influencer) with an identified persona. */
  coreRolesCovered: number;
  stageChangesLast30d: number;
  relevantSignalsLast30d: number;
  /** Average MEDDPICC completeness (0..100) of open opps, or null when none. */
  avgMeddpicc: number | null;
  openOpps: number;
  openOppsWithRisk: number;
}

export const CORE_ROLE_COUNT = 4;

export function computeHealth(
  inputs: HealthInputs,
  weights: HealthWeights = DEFAULT_HEALTH_WEIGHTS,
): ScoreBreakdown {
  const days = inputs.daysSinceLastTouch;
  const parts: Array<Omit<ScoreComponent, "contribution">> = [
    {
      id: "engagement",
      label: "Engagement recency",
      input: days === null ? "never touched" : `${Math.round(days)} days since last touch`,
      // 100% within a week, linear to 0 at 90 days.
      score: days === null ? 0 : clamp01(1 - Math.max(0, days - 7) / 83),
      weight: weights.engagement,
    },
    {
      id: "coverage",
      label: "Buying-committee coverage",
      input: `${inputs.coreRolesCovered} of ${CORE_ROLE_COUNT} core roles`,
      score: clamp01(inputs.coreRolesCovered / CORE_ROLE_COUNT),
      weight: weights.coverage,
    },
    {
      id: "momentum",
      label: "Pipeline momentum",
      input: `${inputs.stageChangesLast30d} stage changes (30d)`,
      score: clamp01(inputs.stageChangesLast30d / 3),
      weight: weights.momentum,
    },
    {
      id: "signals",
      label: "Signal activity",
      input: `${inputs.relevantSignalsLast30d} relevant signals (30d)`,
      score: clamp01(inputs.relevantSignalsLast30d / 10),
      weight: weights.signals,
    },
    {
      id: "quality",
      label: "Opportunity quality",
      input:
        inputs.avgMeddpicc === null
          ? "no open opps (neutral)"
          : `avg MEDDPICC ${Math.round(inputs.avgMeddpicc)}%`,
      score: inputs.avgMeddpicc === null ? 0.5 : clamp01(inputs.avgMeddpicc / 100),
      weight: weights.quality,
    },
    {
      id: "risk",
      label: "Deal risk (inverted)",
      input:
        inputs.openOpps === 0
          ? "no open opps"
          : `${inputs.openOppsWithRisk} of ${inputs.openOpps} open opps flagged`,
      score: inputs.openOpps === 0 ? 1 : clamp01(1 - inputs.openOppsWithRisk / inputs.openOpps),
      weight: weights.risk,
    },
  ];
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0) || 1;
  const components = parts.map((p) => ({
    ...p,
    contribution: round1((p.score * p.weight * 100) / totalWeight),
  }));
  const value = round1(parts.reduce((s, p) => s + (p.score * p.weight * 100) / totalWeight, 0));
  return {
    value,
    components,
    formula: "Health = Σ(weight × sub-score) / Σ(weight) × 100",
  };
}
