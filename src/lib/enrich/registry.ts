import type { PrismaClient } from "@prisma/client";
import { readSetting } from "@/lib/settings/store";
import { discoveredEnrichers } from "./enrichers/_generated";
import type { AccountIdentity, Enricher } from "./types";

/** Run order: website first (finds job boards and feeds), then identity-heavy sources, then the rest. */
const ORDER = [
  "website",
  "sec-edgar",
  "sec-filings-text",
  "sec-officers",
  "gleif",
  "wikidata",
  "dns",
  "hiring",
  "peeringdb",
  "usaspending",
];
const pos = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

export const ENRICHERS: Enricher[] = [...discoveredEnrichers].sort((a, b) => pos(a.id) - pos(b.id));
export const getEnricher = (id: string) => ENRICHERS.find((e) => e.id === id);

export async function enabledEnrichers(db: PrismaClient) {
  const on = await readSetting(db, "enrichment.enabled");
  return ENRICHERS.filter((e) => on[e.id] ?? e.defaultEnabled);
}

/** Why an enricher can't run for this identity (null = it can). */
export function blockedReason(
  e: Enricher,
  id: AccountIdentity,
  env: { secUserAgent: string | null },
) {
  if (id.isDemo) return "Demo accounts are never enriched";
  if (e.needsSecUserAgent && !env.secUserAgent) return "Needs SEC_USER_AGENT in .env.local";
  const missing = e.requires.filter((k) => !id[k]);
  if (missing.length) return `Needs ${missing.join(", ")}`;
  if (e.requiresAny?.length && !e.requiresAny.some((k) => id[k]))
    return `Needs one of: ${e.requiresAny.join(", ")}`;
  return null;
}
