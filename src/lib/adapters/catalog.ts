import type { AdapterKind } from "./types";

/** Static catalog of data sources shown in Settings → Data sources. Implementations live in src/lib/adapters/*. */
export interface SourceCatalogEntry {
  id: string;
  label: string;
  kind: AdapterKind;
  description: string;
  requires?: string;
  defaultEnabled: boolean;
}

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  {
    id: "google-news",
    label: "Google News RSS",
    kind: "public",
    description: "News search per account name (unofficial RSS endpoint; rate-limited, cached).",
    defaultEnabled: true,
  },
  {
    id: "rss-news",
    label: "Custom RSS feeds",
    kind: "public",
    description: "Company newsrooms and trade press feeds you add per account.",
    defaultEnabled: true,
  },
  {
    id: "sec-edgar",
    label: "SEC EDGAR",
    kind: "public",
    description: "Recent 8-K / 10-K / 10-Q filings for accounts with a ticker.",
    requires: "SEC_USER_AGENT",
    defaultEnabled: true,
  },
  {
    id: "greenhouse",
    label: "Greenhouse job boards",
    kind: "public",
    description: "Public job postings when an account has a Greenhouse board slug.",
    defaultEnabled: true,
  },
  {
    id: "lever",
    label: "Lever job boards",
    kind: "public",
    description: "Public job postings when an account has a Lever board slug.",
    defaultEnabled: true,
  },
  {
    id: "gdelt",
    label: "GDELT",
    kind: "public",
    description: "Broader global news/event coverage (optional, off by default).",
    defaultEnabled: false,
  },
  {
    id: "manual",
    label: "Manual entry",
    kind: "manual",
    description: "Paste a URL plus notes.",
    defaultEnabled: true,
  },
  {
    id: "seed",
    label: "Demo live simulator",
    kind: "seed",
    description:
      "Emits occasional synthetic signals for fictional demo accounts so the live feed works offline.",
    defaultEnabled: true,
  },
  {
    id: "crm-placeholder",
    label: "CRM / marketing automation",
    kind: "private-future",
    description: "Not configured — requires company approval.",
    defaultEnabled: false,
  },
];
