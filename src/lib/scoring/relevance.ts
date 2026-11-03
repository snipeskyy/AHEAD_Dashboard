import { z } from "zod";
import type { Tier } from "@/lib/domain/enums";
import { clamp01, round1, type ScoreBreakdown } from "./types";

export const RelevanceConfigSchema = z.object({
  halfLifeDays: z.number().min(0.5).max(90),
  sourceWeights: z.record(z.string(), z.number().min(0).max(1)),
  tierFactors: z.record(z.string(), z.number().min(0).max(1)),
});
export type RelevanceConfig = z.infer<typeof RelevanceConfigSchema>;

export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  halfLifeDays: 7,
  sourceWeights: {
    "sec-edgar": 1,
    manual: 0.9,
    "google-news": 0.8,
    "rss-news": 0.8,
    greenhouse: 0.75,
    lever: 0.75,
    gdelt: 0.6,
    seed: 0.85,
  },
  tierFactors: { Strategic: 1, Growth: 0.8, Maintain: 0.6 },
};

export interface RelevanceInput {
  publishedAt: Date;
  source: string;
  /** Number of keyword hits from the tagging engine. */
  keywordHits: number;
  tier: Tier | string;
  now: Date;
}

export interface RelevanceParts {
  recency: number;
  sourceWeight: number;
  practiceMatch: number;
  tierFactor: number;
}

export function relevanceParts(
  input: RelevanceInput,
  cfg: RelevanceConfig = DEFAULT_RELEVANCE_CONFIG,
): RelevanceParts {
  const ageDays = Math.max(0, (input.now.getTime() - input.publishedAt.getTime()) / 86_400_000);
  return {
    recency: Math.pow(0.5, ageDays / cfg.halfLifeDays),
    sourceWeight: cfg.sourceWeights[input.source] ?? 0.5,
    practiceMatch: 0.4 + 0.6 * clamp01(input.keywordHits / 2),
    tierFactor: cfg.tierFactors[input.tier] ?? 0.6,
  };
}

/** Relevance = recency × source weight × practice match × tier factor, scaled 0..100. */
export function computeRelevance(
  input: RelevanceInput,
  cfg: RelevanceConfig = DEFAULT_RELEVANCE_CONFIG,
): ScoreBreakdown & { parts: RelevanceParts } {
  const parts = relevanceParts(input, cfg);
  const value = round1(
    100 * parts.recency * parts.sourceWeight * parts.practiceMatch * parts.tierFactor,
  );
  return {
    value,
    parts,
    formula: "Relevance = 100 × recency × source weight × practice match × tier factor",
    components: [
      {
        id: "recency",
        label: "Recency",
        input: `half-life ${cfg.halfLifeDays}d`,
        score: parts.recency,
        weight: 1,
        contribution: 0,
      },
      {
        id: "sourceWeight",
        label: "Source weight",
        input: input.source,
        score: parts.sourceWeight,
        weight: 1,
        contribution: 0,
      },
      {
        id: "practiceMatch",
        label: "Practice match",
        input: `${input.keywordHits} keyword hits`,
        score: parts.practiceMatch,
        weight: 1,
        contribution: 0,
      },
      {
        id: "tierFactor",
        label: "Account tier",
        input: String(input.tier),
        score: parts.tierFactor,
        weight: 1,
        contribution: 0,
      },
    ],
  };
}

/** Re-apply recency to stored parts (used by the worker's periodic rescoring). */
export function rescoreFromParts(
  parts: Omit<RelevanceParts, "recency">,
  publishedAt: Date,
  now: Date,
  halfLifeDays = DEFAULT_RELEVANCE_CONFIG.halfLifeDays,
) {
  const ageDays = Math.max(0, (now.getTime() - publishedAt.getTime()) / 86_400_000);
  const recency = Math.pow(0.5, ageDays / halfLifeDays);
  return {
    recency,
    value: round1(100 * recency * parts.sourceWeight * parts.practiceMatch * parts.tierFactor),
  };
}
