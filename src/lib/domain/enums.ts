import { z } from "zod";

/** Shared enum-like values. Prisma stores these as String; Zod is the source of truth. */

export const TIERS = ["Strategic", "Growth", "Maintain"] as const;
export const TierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof TierSchema>;

export const BUYING_ROLES = [
  "EconomicBuyer",
  "Champion",
  "Technical",
  "Influencer",
  "Blocker",
] as const;
export const BuyingRoleSchema = z.enum(BUYING_ROLES);
export type BuyingRole = z.infer<typeof BuyingRoleSchema>;
export const BUYING_ROLE_LABELS: Record<BuyingRole, string> = {
  EconomicBuyer: "Economic Buyer",
  Champion: "Champion",
  Technical: "Technical",
  Influencer: "Influencer",
  Blocker: "Blocker",
};

export const SENIORITIES = ["C-Level", "VP", "Director", "Manager", "IC"] as const;
export const SenioritySchema = z.enum(SENIORITIES);

export const ENGAGEMENT_LEVELS = ["None", "Light", "Engaged", "Strong"] as const;
export const EngagementSchema = z.enum(ENGAGEMENT_LEVELS);

export const PRACTICE_STATUSES = ["NotEngaged", "Exploring", "ActiveOpp", "Delivered"] as const;
export const PracticeStatusSchema = z.enum(PRACTICE_STATUSES);
export type PracticeStatus = z.infer<typeof PracticeStatusSchema>;

export const SIGNAL_TYPES = [
  "news",
  "filing",
  "earnings",
  "exec-change",
  "hiring",
  "m-and-a",
  "funding",
  "partnership",
  "regulatory",
  "incident",
  "expansion",
] as const;
export const SignalTypeSchema = z.enum(SIGNAL_TYPES);
export type SignalType = z.infer<typeof SignalTypeSchema>;
export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  news: "News",
  filing: "Filing",
  earnings: "Earnings",
  "exec-change": "Exec change",
  hiring: "Hiring",
  "m-and-a": "M&A",
  funding: "Funding",
  partnership: "Partnership",
  regulatory: "Regulatory",
  incident: "Outage / incident",
  expansion: "Expansion",
};

export const OPEN_STAGES = ["Qualify", "Discover", "Solution", "Proposal", "Negotiate"] as const;
export const CLOSED_STAGES = ["ClosedWon", "ClosedLost"] as const;
export const STAGES = [...OPEN_STAGES, ...CLOSED_STAGES] as const;
export const StageSchema = z.enum(STAGES);

/** Why a deal closed (Phase 14 win/loss analytics). User-chosen; no reason is ever inferred. */
export const CLOSE_REASONS = [
  "value",
  "relationship",
  "technical-fit",
  "partner",
  "timing",
  "budget",
  "competitor",
  "no-decision",
  "scope-change",
  "other",
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];
export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  value: "Business value / ROI",
  relationship: "Relationship",
  "technical-fit": "Technical fit",
  partner: "Partner alignment",
  timing: "Timing",
  budget: "Budget",
  competitor: "Went with a competitor",
  "no-decision": "No decision",
  "scope-change": "Scope changed",
  other: "Other",
};
export type Stage = z.infer<typeof StageSchema>;
export const STAGE_LABELS: Record<Stage, string> = {
  Qualify: "Qualify",
  Discover: "Discover",
  Solution: "Solution",
  Proposal: "Proposal",
  Negotiate: "Negotiate",
  ClosedWon: "Closed won",
  ClosedLost: "Closed lost",
};
export const STAGE_DEFAULT_PROBABILITY: Record<Stage, number> = {
  Qualify: 10,
  Discover: 20,
  Solution: 40,
  Proposal: 60,
  Negotiate: 80,
  ClosedWon: 100,
  ClosedLost: 0,
};

export const FORECAST_CATEGORIES = ["Pipeline", "BestCase", "Commit", "Closed", "Omitted"] as const;
export const ForecastCategorySchema = z.enum(FORECAST_CATEGORIES);

export const MEDDPICC_KEYS = [
  "metrics",
  "economicBuyer",
  "decisionCriteria",
  "decisionProcess",
  "paperProcess",
  "identifyPain",
  "champion",
  "competition",
] as const;
export type MeddpiccKey = (typeof MEDDPICC_KEYS)[number];
export const MEDDPICC_LABELS: Record<MeddpiccKey, string> = {
  metrics: "Metrics",
  economicBuyer: "Economic Buyer",
  decisionCriteria: "Decision Criteria",
  decisionProcess: "Decision Process",
  paperProcess: "Paper Process",
  identifyPain: "Identify Pain",
  champion: "Champion",
  competition: "Competition",
};
export const MeddpiccStatusSchema = z.enum(["unknown", "partial", "confirmed"]);
export const MeddpiccFieldSchema = z.object({
  status: MeddpiccStatusSchema,
  notes: z.string().default(""),
});
export const MeddpiccSchema = z.object(
  Object.fromEntries(MEDDPICC_KEYS.map((k) => [k, MeddpiccFieldSchema])) as Record<
    MeddpiccKey,
    typeof MeddpiccFieldSchema
  >,
);
export type Meddpicc = z.infer<typeof MeddpiccSchema>;

export const TOUCH_CHANNELS = [
  "email",
  "linkedin",
  "call",
  "meeting",
  "event",
  "briefing",
] as const;
export const TouchChannelSchema = z.enum(TOUCH_CHANNELS);
export const TOUCH_OUTCOMES = ["no-response", "replied", "meeting", "opp-created"] as const;

export const EVENT_KINDS = ["conference", "webinar", "partner", "briefing", "roundtable"] as const;
export const INVITE_STATUSES = [
  "planned",
  "invited",
  "registered",
  "attended",
  "followed-up",
] as const;

export const INTEL_SOURCES = [
  "seed",
  "signal",
  "filing",
  "job-post",
  "news",
  "user-hypothesis",
] as const;
export const IntelSourceSchema = z.enum(INTEL_SOURCES);
export type IntelSource = z.infer<typeof IntelSourceSchema>;
