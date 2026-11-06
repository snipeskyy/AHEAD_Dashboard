/** Fields the smart-list query builder offers, per entity (shared by the builder UI and the server). */
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { SIGNAL_TYPES, STAGES, TIERS } from "@/lib/domain/enums";
import type { SmartEntity, SmartField } from "./smart-lists";

const practices = DEFAULT_PRACTICE_AREAS.map((p) => p.id);

export const SMART_FIELDS: Record<SmartEntity, SmartField[]> = {
  account: [
    { id: "name", label: "Name", type: "text" },
    { id: "tier", label: "Tier", type: "enum", options: [...TIERS] },
    { id: "industry", label: "Industry", type: "text" },
    { id: "healthScore", label: "Health score", type: "number" },
    { id: "whitespaceScore", label: "Whitespace score", type: "number" },
    { id: "openPipeline", label: "Open pipeline ($)", type: "number" },
    { id: "openOpps", label: "Open opportunities", type: "number" },
    { id: "signals7d", label: "Signals (7 days)", type: "number" },
    { id: "lastTouchAt", label: "Last touch", type: "date" },
    { id: "initiativePractices", label: "Initiative evidence in", type: "list", options: practices },
    { id: "openOppPractices", label: "Open opp in practice", type: "list", options: practices },
    { id: "completeness", label: "Data completeness %", type: "number" },
    { id: "identityConfirmed", label: "Identity confirmed", type: "boolean" },
    { id: "hasFiscalYearEnd", label: "Fiscal year end known", type: "boolean" },
  ],
  opportunity: [
    { id: "name", label: "Name", type: "text" },
    { id: "accountName", label: "Account", type: "text" },
    { id: "accountTier", label: "Account tier", type: "enum", options: [...TIERS] },
    { id: "stage", label: "Stage", type: "enum", options: [...STAGES] },
    { id: "practiceArea", label: "Practice area", type: "enum", options: practices },
    { id: "amount", label: "Amount ($)", type: "number" },
    { id: "closeDate", label: "Close date", type: "date" },
    { id: "nextStepDate", label: "Next step date", type: "date" },
    { id: "meddpiccScore", label: "MEDDPICC %", type: "number" },
    { id: "daysInStage", label: "Days in stage", type: "number" },
    { id: "riskFlags", label: "Risk flags", type: "list", options: ["stalled", "pushed", "no-economic-buyer", "low-meddpicc", "past-close-date", "no-next-step"] },
  ],
  signal: [
    { id: "title", label: "Title", type: "text" },
    { id: "accountName", label: "Account", type: "text" },
    { id: "accountTier", label: "Account tier", type: "enum", options: [...TIERS] },
    { id: "type", label: "Type", type: "enum", options: [...SIGNAL_TYPES] },
    { id: "relevance", label: "Relevance", type: "number" },
    { id: "practiceTags", label: "Practice tags", type: "list", options: practices },
    { id: "publishedAt", label: "Published", type: "date" },
    { id: "starred", label: "Starred", type: "boolean" },
    { id: "triaged", label: "Triaged", type: "boolean" },
  ],
};
