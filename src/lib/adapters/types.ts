import type { ZodType } from "zod";

export type AdapterKind = "public" | "seed" | "manual" | "private-future";

export interface AdapterFetchContext {
  /** Accounts the adapter should look at (real + demo, filtered by caller). */
  accounts: Array<{
    id: string;
    name: string;
    domain: string | null;
    ticker: string | null;
    cik: string | null;
    sourceConfig: unknown;
  }>;
  signal?: AbortSignal;
  now: Date;
}

/**
 * A data source. Raw payloads are validated with `rawSchema` (Zod) before `normalize`.
 * `T` is the internal shape (usually a NormalizedSignal).
 */
export interface DataAdapter<T, Raw = unknown> {
  id: string;
  label: string;
  kind: AdapterKind;
  description: string;
  /** cron-like schedule string, informational; the worker owns timing. */
  schedule?: string;
  rawSchema?: ZodType<Raw>;
  fetch(ctx: AdapterFetchContext): Promise<T[]>;
  normalize(raw: Raw, ctx: { accountId: string; now: Date }): T | null;
}

export class AdapterNotConfiguredError extends Error {
  constructor(adapterId: string, reason: string) {
    super(`[${adapterId}] not configured — ${reason}`);
    this.name = "AdapterNotConfiguredError";
  }
}
