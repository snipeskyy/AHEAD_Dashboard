import {
  BUYING_ROLE_LABELS,
  BUYING_ROLES,
  ENGAGEMENT_LEVELS,
  SENIORITIES,
  type BuyingRole,
} from "@/lib/domain/enums";
import type { ImportKindDef, RowIssue } from "../types";
import { cell, matchEnum } from "../values";
import { ACCOUNT_REF_FIELD } from "./shared";

export interface ContactImportValue {
  account: string;
  displayName: string | null;
  title: string;
  function: string;
  seniority: (typeof SENIORITIES)[number];
  buyingRole: BuyingRole;
  engagement: (typeof ENGAGEMENT_LEVELS)[number];
}

/** Seniority from a title when the column is missing ("Chief…" → C-Level, "VP…" → VP, …). */
export function inferSeniority(title: string): (typeof SENIORITIES)[number] {
  const t = title.toLowerCase();
  if (/\bchief\b|^c[a-z]o\b|\bcio\b|\bcto\b|\bciso\b|\bcfo\b|\bceo\b|\bcoo\b/.test(t))
    return "C-Level";
  if (/\b(svp|evp|vp|vice president)\b/.test(t)) return "VP";
  if (/\bdirector\b|\bhead of\b/.test(t)) return "Director";
  if (/\bmanager\b|\blead\b/.test(t)) return "Manager";
  return "IC";
}

export const contactsKind: ImportKindDef<ContactImportValue> = {
  id: "contacts",
  label: "Contacts",
  singular: "contact",
  description:
    "People you work with, entered by you. Name is optional; no personal contact details are stored.",
  fields: [
    ACCOUNT_REF_FIELD,
    {
      id: "displayName",
      label: "Name",
      aliases: ["name", "full name", "contact", "contact name", "display name"],
      example: "Jordan Lee",
    },
    {
      id: "title",
      label: "Title",
      required: true,
      aliases: ["title", "job title", "role", "position"],
      example: "VP, Infrastructure & Operations",
    },
    {
      id: "function",
      label: "Function",
      aliases: ["function", "department", "team"],
      example: "IT",
    },
    {
      id: "seniority",
      label: "Seniority",
      aliases: ["seniority", "level"],
      example: "VP",
      hint: "C-Level, VP, Director, Manager or IC (inferred from title if blank)",
    },
    {
      id: "buyingRole",
      label: "Buying role",
      aliases: ["buying role", "role in deal", "persona", "meddpicc role"],
      example: "Champion",
      hint: "Economic Buyer, Champion, Technical, Influencer or Blocker",
    },
    {
      id: "engagement",
      label: "Engagement",
      aliases: ["engagement", "relationship", "relationship strength"],
      example: "Engaged",
      hint: "None, Light, Engaged or Strong",
    },
  ],
  normalize(r) {
    const errors: RowIssue[] = [];
    const account = cell(r.account);
    if (!account) errors.push({ field: "account", message: "Account is required" });
    const title = cell(r.title).replace(/\s+/g, " ");
    if (title.length < 2 || title.length > 120)
      errors.push({ field: "title", message: "Title is required (2–120 characters)" });
    const sRaw = cell(r.seniority);
    const seniority = sRaw
      ? matchEnum(
          sRaw,
          SENIORITIES,
          {},
          { clevel: "C-Level", cxo: "C-Level", svp: "VP", evp: "VP" },
        )
      : inferSeniority(title);
    if (!seniority) errors.push({ field: "seniority", message: `Unknown seniority "${sRaw}"` });
    const bRaw = cell(r.buyingRole);
    const buyingRole = bRaw
      ? matchEnum(bRaw, BUYING_ROLES, BUYING_ROLE_LABELS, {
          eb: "EconomicBuyer",
          tech: "Technical",
          technicalbuyer: "Technical",
        })
      : "Influencer";
    if (!buyingRole) errors.push({ field: "buyingRole", message: `Unknown buying role "${bRaw}"` });
    const eRaw = cell(r.engagement);
    const engagement = eRaw ? matchEnum(eRaw, ENGAGEMENT_LEVELS) : "None";
    if (!engagement) errors.push({ field: "engagement", message: `Unknown engagement "${eRaw}"` });
    if (errors.length || !seniority || !buyingRole || !engagement) return { ok: false, errors };
    return {
      ok: true,
      value: {
        account,
        displayName: cell(r.displayName).slice(0, 120) || null,
        title,
        function: cell(r.function).slice(0, 80) || "Other",
        seniority,
        buyingRole,
        engagement,
      },
    };
  },
};
