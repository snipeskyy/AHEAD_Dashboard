import { ENRICHERS } from "@/lib/enrich/registry";
import { getSetting } from "@/lib/settings/server";
import { handler, json } from "@/lib/server/http";

/** Enricher catalog + on/off state for Settings → Data sources (never returns secret values). */
export const GET = handler(async () => {
  const [on, autoApply, concurrency, autoRefresh] = await Promise.all([
    getSetting("enrichment.enabled"),
    getSetting("enrichment.autoApply"),
    getSetting("enrichment.concurrency"),
    getSetting("enrichment.autoRefresh"),
  ]);
  return json({
    autoApply,
    concurrency,
    autoRefresh,
    env: {
      SEC_USER_AGENT: !!process.env.SEC_USER_AGENT?.trim(),
      ENRICH_USER_AGENT: !!process.env.ENRICH_USER_AGENT?.trim(),
    },
    enrichers: ENRICHERS.map((e) => ({
      id: e.id,
      label: e.label,
      source: e.source,
      description: e.description,
      ttlDays: e.ttlDays,
      optional: !!e.optional,
      needsSecUserAgent: !!e.needsSecUserAgent,
      enabled: on[e.id] ?? e.defaultEnabled,
    })),
  });
});
