/** Every score is explainable: a value plus the components that produced it. */
export interface ScoreComponent {
  id: string;
  label: string;
  /** Human-readable raw input, e.g. "12 days" or "3 of 4 roles". */
  input: string;
  /** Normalized 0..1 sub-score. */
  score: number;
  weight: number;
  /** Points contributed to the final 0..100 value. */
  contribution: number;
}

export interface ScoreBreakdown {
  value: number;
  components: ScoreComponent[];
  formula: string;
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export const round1 = (n: number) => Math.round(n * 10) / 10;
