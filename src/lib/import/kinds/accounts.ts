import { TIERS, type Tier } from "@/lib/domain/enums";
import { normalizeDomain, normalizeTicker } from "../normalize";
import type { ImportKindDef, RowIssue } from "../types";
import { cell, matchEnum } from "../values";

export interface AccountImportValue {
  name: string;
  domain: string | null;
  ticker: string | null;
  industry: string | null;
  subIndustry: string | null;
  hq: string | null;
  /** null = not given (new accounts default to Growth; merges keep the current tier). */
  tier: Tier | null;
  employeeBand: string | null;
  revenueBand: string | null;
  ownerNotes: string | null;
  greenhouseSlug: string | null;
  leverSlug: string | null;
}

const slug = (v: string) => (/^[a-z0-9][a-z0-9-_]{0,79}$/i.test(v) ? v.toLowerCase() : null);
const text = (v: string, max: number) => (v ? v.slice(0, max) : null);

export const accountsKind: ImportKindDef<AccountImportValue> = {
  id: "accounts",
  label: "Accounts",
  singular: "account",
  description:
    "The companies you cover. Public identifiers only; intelligence comes from public sources.",
  fields: [
    {
      id: "name",
      label: "Company name",
      required: true,
      aliases: ["name", "company", "company name", "account", "account name", "organization"],
      example: "Example Holdings Inc.",
    },
    {
      id: "domain",
      label: "Domain / website",
      aliases: ["domain", "website", "url", "web", "site", "company website"],
      example: "example.com",
    },
    {
      id: "ticker",
      label: "Ticker",
      aliases: ["ticker", "symbol", "stock", "ticker symbol"],
      example: "EXMP",
      hint: "Public companies only; enables SEC filings.",
    },
    {
      id: "industry",
      label: "Industry",
      aliases: ["industry", "sector", "vertical"],
      example: "Insurance",
    },
    {
      id: "subIndustry",
      label: "Sub-industry",
      aliases: ["sub-industry", "subindustry", "sub industry", "segment detail"],
      example: "",
    },
    {
      id: "hq",
      label: "HQ location",
      aliases: ["hq", "headquarters", "location", "city", "hq location"],
      example: "Chicago, IL",
    },
    {
      id: "tier",
      label: "Tier",
      aliases: ["tier", "segment", "priority", "account tier"],
      example: "Strategic",
      hint: "Strategic, Growth or Maintain",
    },
    {
      id: "employeeBand",
      label: "Employees",
      aliases: ["employees", "employee count", "headcount", "employee band", "size"],
      example: "",
    },
    {
      id: "revenueBand",
      label: "Revenue",
      aliases: ["revenue", "annual revenue", "revenue band"],
      example: "",
    },
    {
      id: "ownerNotes",
      label: "Notes",
      aliases: ["notes", "owner notes", "comments"],
      example: "",
    },
    {
      id: "greenhouseSlug",
      label: "Greenhouse board slug",
      aliases: ["greenhouse", "greenhouse slug"],
      example: "",
    },
    { id: "leverSlug", label: "Lever board slug", aliases: ["lever", "lever slug"], example: "" },
  ],
  normalize(r) {
    const errors: RowIssue[] = [];
    const name = cell(r.name).replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 160)
      errors.push({ field: "name", message: "Company name is required (2–160 characters)" });
    const domainRaw = cell(r.domain);
    const domain = domainRaw ? normalizeDomain(domainRaw) : null;
    if (domainRaw && !domain)
      errors.push({ field: "domain", message: `Invalid domain "${domainRaw}"` });
    const tickerRaw = cell(r.ticker);
    const ticker = tickerRaw ? normalizeTicker(tickerRaw) : null;
    if (tickerRaw && !ticker)
      errors.push({ field: "ticker", message: `Invalid ticker "${tickerRaw}"` });
    const tierRaw = cell(r.tier);
    const tier = tierRaw ? matchEnum(tierRaw, TIERS) : null;
    if (tierRaw && !tier)
      errors.push({
        field: "tier",
        message: `Unknown tier "${tierRaw}" (use Strategic, Growth or Maintain)`,
      });
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      value: {
        name,
        domain,
        ticker,
        industry: text(cell(r.industry), 80),
        subIndustry: text(cell(r.subIndustry), 80),
        hq: text(cell(r.hq), 120),
        tier,
        employeeBand: text(cell(r.employeeBand), 40),
        revenueBand: text(cell(r.revenueBand), 40),
        ownerNotes: text(cell(r.ownerNotes), 4000),
        greenhouseSlug: slug(cell(r.greenhouseSlug)),
        leverSlug: slug(cell(r.leverSlug)),
      },
    };
  },
};
