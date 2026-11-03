import { CLOSED_STAGES, type Meddpicc, type Stage } from "@/lib/domain/enums";
import { meddpiccCompleteness } from "./meddpicc";

export interface DealRiskInput {
  stage: Stage;
  stageChangedAt: Date;
  closeDate: Date;
  closeDatePushes: number;
  meddpicc: Meddpicc;
}

export type DealRiskFlag =
  "stalled" | "pushed" | "no-economic-buyer" | "low-meddpicc" | "past-close-date";

export const DEAL_RISK_LABELS: Record<DealRiskFlag, string> = {
  stalled: "Stalled in stage",
  pushed: "Close date pushed 2+ times",
  "no-economic-buyer": "Missing Economic Buyer",
  "low-meddpicc": "MEDDPICC below 50%",
  "past-close-date": "Close date in the past",
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
  return flags;
}
