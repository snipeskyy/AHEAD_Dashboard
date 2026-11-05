import { SOURCE_CATALOG } from "./catalog";
import type { AdapterAccount, DataAdapter, NormalizedSignal } from "./types";

/** What "Fetch now" can actually do, per source, and what is missing when it can't. */
export interface SourceCoverage {
  id: string;
  label: string;
  enabled: boolean;
  /** Accounts this source would query right now. */
  eligible: number;
  total: number;
  /** Plain-language reason when nothing will run (or partial coverage). */
  hint: string | null;
  /** One-click fix the UI can offer. */
  action: "enable-google-news" | "enable-source" | null;
}

export interface CoverageInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Raw types, only eligible() is used
  adapters: DataAdapter<NormalizedSignal, any>[];
  accounts: AdapterAccount[];
  enabled: Record<string, boolean>;
  env: { secUserAgent: boolean; publicFetch: boolean };
}

const HINTS: Record<string, string> = {
  "google-news":
    "Off for every account (it's opt-in). Turn it on for all accounts, or per account on Account 360 → Sources.",
  "rss-news":
    "No account has an RSS feed yet. Add a newsroom or trade-press feed on Account 360 → Sources.",
  "sec-edgar":
    "No account has a stock ticker. Add tickers for public companies (Accounts → edit, or re-import with a Ticker column).",
  greenhouse: "No account has a Greenhouse board slug. Add one on Account 360 → Sources.",
  lever: "No account has a Lever board slug. Add one on Account 360 → Sources.",
  gdelt: "No real accounts yet.",
};

export function computeCoverage(input: CoverageInput): SourceCoverage[] {
  const real = input.accounts.filter((a) => !a.isDemo);
  return input.adapters
    .filter((a) => a.kind === "public")
    .map((a) => {
      const meta = SOURCE_CATALOG.find((s) => s.id === a.id);
      const enabled =
        (input.enabled[a.id] ?? meta?.defaultEnabled ?? false) && input.env.publicFetch;
      const eligible = input.accounts.filter((acc) => a.eligible?.(acc) ?? true).length;
      const base = { id: a.id, label: meta?.label ?? a.id, enabled, eligible, total: real.length };
      if (!input.env.publicFetch)
        return {
          ...base,
          hint: "PUBLIC_FETCH_ENABLED=false in .env.local blocks all outbound fetches.",
          action: null,
        };
      if (!enabled)
        return {
          ...base,
          hint: "Turned off in Settings → Data sources.",
          action: "enable-source" as const,
        };
      if (a.id === "sec-edgar" && !input.env.secUserAgent)
        return {
          ...base,
          eligible: 0,
          hint: `SEC requires a contact User-Agent. Add SEC_USER_AGENT to .env.local and restart${eligible ? ` (${eligible} accounts have tickers)` : ""}.`,
          action: null,
        };
      if (!eligible)
        return {
          ...base,
          hint: HINTS[a.id] ?? "No eligible accounts.",
          action: a.id === "google-news" ? ("enable-google-news" as const) : null,
        };
      return { ...base, hint: null, action: null };
    });
}

/** Total account-source pairs that would run; 0 means "Fetch now" can't find anything. */
export const runnableCount = (c: SourceCoverage[]) =>
  c.reduce((n, s) => n + (s.enabled ? s.eligible : 0), 0);
