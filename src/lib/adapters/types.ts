import type { PrismaClient } from "@prisma/client";
import type { ZodType } from "zod";
import type { SignalType } from "@/lib/domain/enums";

export type AdapterKind = "public" | "seed" | "manual" | "private-future";

export interface AdapterAccount {
  id: string;
  name: string;
  domain: string | null;
  ticker: string | null;
  cik: string | null;
  isDemo: boolean;
  tier: string;
  sourceConfig: AccountSourceConfig;
}

export interface AccountSourceConfig {
  googleNews?: boolean;
  rssFeeds?: string[];
  greenhouseSlug?: string | null;
  leverSlug?: string | null;
}

export interface AdapterFetchContext {
  db: PrismaClient;
  accounts: AdapterAccount[];
  now: Date;
  signal?: AbortSignal;
  env: { secUserAgent: string | null };
  log: (msg: string) => void;
}

/** Evidence an adapter can derive alongside a signal (e.g. job posts → initiative / tech stack). */
export type DerivedEvidence =
  | {
      kind: "initiative";
      title: string;
      description: string;
      practiceAreas: string[];
      confidence: number;
    }
  | { kind: "tech"; category: string; technology: string; evidence: string; confidence: number };

/** Internal signal shape produced by every adapter's normalize(). Validated before ingest. */
export interface NormalizedSignal {
  accountId: string;
  type: SignalType;
  title: string;
  summary: string | null;
  url: string | null;
  source: string;
  publishedAt: Date;
  /** Optional extra text used only for tagging (not stored). */
  tagText?: string;
  /** Stable identity for dedupe when url+title is not enough (e.g. weekly hiring roll-ups). */
  dedupeKey?: string;
  evidence?: DerivedEvidence[];
  /** "high" = material event (e.g. 8-K Items 1.01, 1.05, 2.01, 5.02): relevance floor 90 and always alerts. */
  priority?: "high";
}

/**
 * A data source. Raw payloads are validated with `rawSchema` (Zod) before `normalize`.
 * `fetch` returns normalized items; the ingest pipeline tags, scores, dedupes and stores them.
 */
export interface DataAdapter<T = NormalizedSignal, Raw = unknown> {
  id: string;
  label: string;
  kind: AdapterKind;
  description: string;
  /** Informational; the worker owns timing (Settings → scheduler interval). */
  schedule?: string;
  rawSchema?: ZodType<Raw>;
  /** Which accounts this adapter applies to. */
  eligible?: (a: AdapterAccount) => boolean;
  fetch(ctx: AdapterFetchContext): Promise<T[]>;
  normalize(raw: Raw, ctx: { account: AdapterAccount; now: Date }): T[];
}

export class AdapterNotConfiguredError extends Error {
  constructor(adapterId: string, reason: string) {
    super(`[${adapterId}] not configured — ${reason}`);
    this.name = "AdapterNotConfiguredError";
  }
}
