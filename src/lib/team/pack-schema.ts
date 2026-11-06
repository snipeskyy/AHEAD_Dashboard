import { z } from "zod";
import { canSee, type VisibilityField } from "@/config/roles";

/**
 * Shareable account pack (Phase 8): a portable JSON file a teammate imports into their own ACC.
 * Pure: schema, section catalog and the redaction rules. Server code builds and imports it.
 */
export const PACK_FORMAT = "acc-pack";
export const PACK_VERSION = 1;

export const PACK_SECTIONS = [
  { id: "profile", label: "Profile fields with sources", hint: "Firmographics and identifiers, each with its source link and confidence.", default: true },
  { id: "evidence", label: "Initiatives & tech stack", hint: "Public evidence (with links) and hypotheses marked as such.", default: true },
  { id: "contacts", label: "Buying committee roles", hint: "Titles, functions and buying roles.", default: true },
  { id: "contactNames", label: "Contact names", hint: "Names you entered or accepted from filings. Off by default.", default: false },
  { id: "tier", label: "Tier", hint: "Your Strategic / Growth / Maintain call.", default: false },
  { id: "opportunities", label: "Opportunities", hint: "Name, stage, practice, close date, next step.", default: false },
  { id: "amounts", label: "Deal amounts & MEDDPICC", hint: "Only with Opportunities.", default: false },
  { id: "notes", label: "Notes", hint: "Your private notes on the account.", default: false },
  { id: "comments", label: "Comments", hint: "Comment threads with @mentions.", default: false },
] as const;
export type PackSection = (typeof PACK_SECTIONS)[number]["id"];
export const DEFAULT_PACK_SECTIONS = PACK_SECTIONS.filter((s) => s.default).map((s) => s.id) as PackSection[];

/** Sections a role may not include (mirrors on-screen visibility). */
const ROLE_GATES: Partial<Record<PackSection, VisibilityField>> = { amounts: "opp.amount", notes: "notes" };

/** Effective sections after role gating and dependencies ("amounts" needs "opportunities", names need contacts). */
export function effectiveSections(requested: readonly string[], role: string): PackSection[] {
  const want = new Set(requested.filter((s): s is PackSection => PACK_SECTIONS.some((p) => p.id === s)));
  for (const [s, f] of Object.entries(ROLE_GATES)) if (!canSee(role, f)) want.delete(s as PackSection);
  if (!want.has("opportunities")) want.delete("amounts");
  if (!want.has("contacts")) want.delete("contactNames");
  return PACK_SECTIONS.map((p) => p.id).filter((id) => want.has(id));
}

const str = z.string().max(4000);
const opt = str.nullish();

export const PackFieldSchema = z.object({
  field: z.string().max(120),
  value: z.unknown(),
  source: z.string().max(120),
  sourceUrl: z.string().max(2000).nullish(),
  confidence: z.string().max(20),
  fetchedAt: z.string().nullish(),
});

export const PackAccountSchema = z.object({
  ref: z.string().max(64),
  identity: z.object({
    name: z.string().min(1).max(200),
    domain: opt, ticker: opt, cik: opt, lei: opt, wikidataId: opt, fiscalYearEnd: opt,
    industry: opt, subIndustry: opt, hq: opt, employeeBand: opt, revenueBand: opt,
  }),
  tier: opt,
  fields: z.array(PackFieldSchema).max(500).optional(),
  initiatives: z.array(z.object({ title: str, description: opt, practiceAreas: z.array(z.string()).max(20).default([]), evidence: opt, section: opt, source: z.string().max(40), sourceUrl: opt, confidence: z.number().min(0).max(1) })).max(500).optional(),
  techStack: z.array(z.object({ category: str, technology: str, evidence: z.string().max(4000).default(""), source: z.string().max(40), sourceUrl: opt, confidence: z.number().min(0).max(1), status: z.string().max(20).default("hypothesis") })).max(500).optional(),
  contacts: z.array(z.object({ title: str, function: str, seniority: str, buyingRole: str, engagement: z.string().max(20).default("None"), displayName: opt, source: opt, sourceUrl: opt })).max(500).optional(),
  opportunities: z.array(z.object({
    ref: z.string().max(64), name: str, practiceArea: str, stage: str, closeDate: z.string(),
    nextStep: opt, nextStepDate: z.string().nullish(), partners: z.array(z.string()).max(30).default([]),
    amount: z.number().nullish(), meddpicc: z.unknown().optional(), competitors: z.array(z.string()).max(30).optional(),
  })).max(500).optional(),
  notes: z.array(z.object({ body: str, createdAt: z.string() })).max(1000).optional(),
  comments: z.array(z.object({ body: str, authorName: z.string().max(120), mentionNames: z.array(z.string()).max(30).default([]), createdAt: z.string(), oppRef: z.string().nullish() })).max(2000).optional(),
});

export const PackSchema = z.object({
  format: z.literal(PACK_FORMAT),
  version: z.literal(PACK_VERSION),
  title: z.string().max(200),
  createdAt: z.string(),
  createdBy: z.object({ name: z.string().max(120), role: z.string().max(60) }),
  sections: z.array(z.string()).max(20),
  accounts: z.array(PackAccountSchema).min(1).max(1000),
});
export type Pack = z.infer<typeof PackSchema>;
export type PackAccount = z.infer<typeof PackAccountSchema>;

/** Confidence for a pack value proposed on import (a teammate's value is never "user" or "verified" here). */
export function proposalConfidence(c: string): "high" | "medium" | "low" {
  return c === "verified" || c === "high" ? "high" : c === "low" ? "low" : "medium";
}

/** File name for a pack download. */
export function packFileName(title: string, now = new Date()) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "accounts";
  return `acc-pack-${slug}-${now.toISOString().slice(0, 10)}.json`;
}
