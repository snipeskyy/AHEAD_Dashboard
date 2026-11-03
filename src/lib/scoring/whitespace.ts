import type { PracticeStatus } from "@/lib/domain/enums";
import { clamp01, round1, type ScoreBreakdown } from "./types";

export const STATUS_GAP: Record<PracticeStatus, number> = {
  NotEngaged: 1,
  Exploring: 0.6,
  ActiveOpp: 0.2,
  Delivered: 0,
};

export interface WhitespaceInput {
  practiceArea: string;
  label: string;
  status: PracticeStatus;
  /** 0..1 strength of evidence (initiatives / signals) that the account needs this practice. */
  demand: number;
}

/**
 * Whitespace = Σ(w × gap × (1 + 0.5 × demand)) / Σ(w × 1.5) × 100.
 * High when many weighted practices are un-engaged AND the account shows demand for them.
 */
export function computeWhitespace(
  inputs: WhitespaceInput[],
  practiceWeights: Record<string, number> = {},
): ScoreBreakdown {
  const w = (id: string) => practiceWeights[id] ?? 1;
  const denom = inputs.reduce((s, i) => s + w(i.practiceArea) * 1.5, 0) || 1;
  const components = inputs.map((i) => {
    const gap = STATUS_GAP[i.status];
    const demand = clamp01(i.demand);
    const raw = w(i.practiceArea) * gap * (1 + 0.5 * demand);
    return {
      id: i.practiceArea,
      label: i.label,
      input: `${i.status}, demand ${Math.round(demand * 100)}%`,
      score: clamp01((gap * (1 + 0.5 * demand)) / 1.5),
      weight: w(i.practiceArea),
      contribution: round1((raw / denom) * 100),
    };
  });
  const raw = inputs.reduce(
    (s, i) => s + w(i.practiceArea) * STATUS_GAP[i.status] * (1 + 0.5 * clamp01(i.demand)),
    0,
  );
  return {
    value: round1((raw / denom) * 100),
    components,
    formula: "Whitespace = Σ(weight × gap × (1 + 0.5 × demand)) / Σ(weight × 1.5) × 100",
  };
}
