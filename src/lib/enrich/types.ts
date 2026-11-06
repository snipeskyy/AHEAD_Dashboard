import type { PrismaClient } from "@prisma/client";

/** Step 1 output: exactly which entity an account is. */
export interface AccountIdentity {
  accountId: string;
  name: string;
  legalName?: string | null;
  domain?: string | null;
  ticker?: string | null;
  cik?: string | null;
  lei?: string | null;
  wikidataId?: string | null;
  jobBoard?: { provider: JobBoardProvider; slug: string } | null;
  newsroomRss?: string | null;
  confirmedByUser: boolean;
  isDemo: boolean;
}

export const JOB_BOARD_PROVIDERS = ["greenhouse", "lever", "ashby", "smartrecruiters"] as const;
export type JobBoardProvider = (typeof JOB_BOARD_PROVIDERS)[number];

export interface ProposalInput {
  field: string;
  value: unknown;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
  evidenceSnippet?: string;
  /** Overrides the enricher's source label for this item. */
  source?: string;
}

export interface FinancialInput {
  metric: "revenue" | "netIncome" | "capex";
  fiscalYear: number;
  periodEnd: Date;
  value: number;
  unit: string;
  sourceUrl: string;
}

export interface RelationInput {
  relation: "direct-parent" | "ultimate-parent" | "subsidiary";
  name: string;
  lei?: string | null;
  wikidataId?: string | null;
  country?: string | null;
  source: string;
  sourceUrl: string;
}

export interface EnrichResult {
  proposals: ProposalInput[];
  financials?: FinancialInput[];
  relations?: RelationInput[];
}

export interface HttpPage {
  status: number;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface EnrichContext {
  db: PrismaClient;
  now: Date;
  signal: AbortSignal;
  log: (msg: string) => void;
  env: { userAgent: string; secUserAgent: string | null };
  http: {
    json<T = unknown>(
      url: string,
      o?: {
        ttlMs?: number;
        minIntervalMs?: number;
        headers?: Record<string, string>;
        method?: "GET" | "POST";
        body?: string;
      },
    ): Promise<T>;
    text(
      url: string,
      o?: {
        ttlMs?: number;
        minIntervalMs?: number;
        headers?: Record<string, string>;
        noStore?: boolean;
        maxBytes?: number;
      },
    ): Promise<string>;
    /** Website fetch that honors robots.txt and returns headers (for tech detection). */
    page(url: string, o?: { ttlMs?: number }): Promise<HttpPage | null>;
  };
}

export type IdentityKey = keyof Omit<
  AccountIdentity,
  "accountId" | "name" | "confirmedByUser" | "isDemo"
>;

/**
 * A self-contained public source. Drop a folder in src/lib/enrich/enrichers/<id>/ with an index.ts that
 * default-exports one of these; `npm run gen:modules` discovers it. Keep parsing in a pure normalize().
 */
export interface Enricher {
  id: string;
  label: string;
  /** Short source name shown on chips, e.g. "SEC EDGAR". */
  source: string;
  description: string;
  requires: IdentityKey[];
  /** At least one of these must be present (e.g. ticker or CIK). */
  requiresAny?: IdentityKey[];
  produces: string[];
  ttlDays: number;
  defaultEnabled: boolean;
  /** Optional toggles (PeeringDB, USAspending) are off by default and labeled as such. */
  optional?: boolean;
  /** Needs SEC_USER_AGENT (SEC fair-access policy). */
  needsSecUserAgent?: boolean;
  /** Real (non-demo) accounts only. Defaults to true for every enricher. */
  run(identity: AccountIdentity, ctx: EnrichContext): Promise<EnrichResult>;
}
