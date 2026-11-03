import {
  MEDDPICC_KEYS,
  MEDDPICC_LABELS,
  OPEN_STAGES,
  type Meddpicc,
  type Stage,
} from "@/lib/domain/enums";

const STATUS_POINTS = { unknown: 0, partial: 0.5, confirmed: 1 } as const;

export function emptyMeddpicc(): Meddpicc {
  return Object.fromEntries(
    MEDDPICC_KEYS.map((k) => [k, { status: "unknown", notes: "" }]),
  ) as Meddpicc;
}

/** Completeness 0..100: each of 8 fields scores 0 / 0.5 / 1. */
export function meddpiccCompleteness(m: Meddpicc): number {
  const total = MEDDPICC_KEYS.reduce((s, k) => s + STATUS_POINTS[m[k]?.status ?? "unknown"], 0);
  return Math.round((total / MEDDPICC_KEYS.length) * 100);
}

const stageIndex = (s: Stage) => (OPEN_STAGES as readonly string[]).indexOf(s);

/** Stage-aware red flags. */
export function meddpiccRedFlags(m: Meddpicc, stage: Stage): string[] {
  const flags: string[] = [];
  const idx = stageIndex(stage);
  const missing = (k: (typeof MEDDPICC_KEYS)[number]) => (m[k]?.status ?? "unknown") === "unknown";
  if (missing("economicBuyer")) flags.push(`No ${MEDDPICC_LABELS.economicBuyer} identified`);
  if (idx >= stageIndex("Solution") && missing("champion"))
    flags.push("No Champion at Solution stage or later");
  if (idx >= stageIndex("Solution") && missing("identifyPain"))
    flags.push("Pain not identified at Solution stage or later");
  if (idx >= stageIndex("Proposal") && missing("decisionProcess"))
    flags.push("Decision Process unknown at Proposal or later");
  if (idx >= stageIndex("Negotiate") && missing("paperProcess"))
    flags.push("Paper Process unknown at Negotiate");
  return flags;
}
