import type { DealRiskFlag } from "@/lib/scoring/deal-risk";
import type { Stage } from "@/lib/domain/enums";

/** Opportunity row DTO shared by API + UI (dates as ISO strings). */
export interface OppRow {
  id: string;
  accountId: string;
  accountName: string;
  accountTier: string;
  accountIsDemo: boolean;
  name: string;
  practiceArea: string;
  stage: Stage;
  amount: number;
  weighted: number;
  closeDate: string;
  probability: number;
  forecastCategory: string;
  nextStep: string | null;
  nextStepDate: string | null;
  partners: string[];
  competitors: string[];
  closeDatePushes: number;
  stageChangedAt: string;
  createdAt: string;
  closedAt: string | null;
  meddpiccScore: number;
  riskFlags: DealRiskFlag[];
  daysInStage: number;
}

/** Minimal shape needed by the pure pipeline analytics functions. */
export interface PipelineOpp {
  stage: string;
  amount: number;
  probability: number;
  forecastCategory: string;
  closeDate: Date;
  createdAt: Date;
  closedAt: Date | null;
  stageChangedAt: Date;
  practiceArea: string;
}

export interface StageEvent {
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  changedAt: Date;
}
