import { CLOSED_STAGES, type Meddpicc, type Stage } from "@/lib/domain/enums";
import { meddpiccCompleteness } from "./meddpicc";

export interface DealRiskInput {
  stage: Stage;
  stageChangedAt: Date;
  closeDate: Date;
  closeDatePushes: number;
  meddpicc: Meddpicc;
  /** Phase 7: every open deal needs a dated next step (undefined = not checked, for older callers). */
  nextStepDate?: Date | null;
}

export type DealRiskFlag =
  | "stalled"
  | "pushed"
  | "no-economic-buyer"
  | "low-meddpicc"
  | "past-close-date"
  | "no-next-step";

export const DEAL_RISK_LABELS: Record<DealRiskFlag, string> = {
  stalled: "Stalled in stage",
  pushed: "Close date pushed 2+ times",
  "no-economic-buyer": "Missing Economic Buyer",
  "low-meddpicc": "MEDDPICC below 50%",
  "past-close-date": "Close date in the past",
  "no-next-step": "No dated next step (or it's overdue)",
};

export function dealRiskFlags(o: DealRiskInput, now: Date, stalledDays = 30): DealRiskFlag[] {
  if ((CLOSED_STAGES as readonly string[]).includes(o.stage)) return [];
  const flags: DealRiskFlag[] = [];
  if ((now.getTime() - o.stageChangedAt.getTime()) / 86_400_000 > stalledDays)
    flags.push("stalled");
  if (o.closeDatePushes >= 2) flags.push("pushed");
  if ((o.meddpicc.economicBuyer?.status ?? "unknown") === "unknown")
    flags.push("no-economic-buyer");
  if (meddpiccCompleteness(o.meddpicc) < 50) flags.push("low-meddpicc");
  if (o.closeDate.getTime() < now.getTime()) flags.push("past-close-date");
  if (o.nextStepDate !== undefined && (!o.nextStepDate || o.nextStepDate.getTime() < now.getTime() - 86_400_000))
    flags.push("no-next-step");
  return flags;
}
