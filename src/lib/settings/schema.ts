import { z } from "zod";
import { ACCENT_IDS, themeConfig, type AccentId } from "@/config/theme";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { DEFAULT_HEALTH_WEIGHTS, HealthWeightsSchema } from "@/lib/scoring/health";
import { DEFAULT_RELEVANCE_CONFIG, RelevanceConfigSchema } from "@/lib/scoring/relevance";
import { DEFAULT_TAGGING_RULES, TaggingRuleSchema } from "@/lib/tagging/rules";

/**
 * Typed settings registry. Each key is stored as one row in the Setting table.
 * Missing rows fall back to these defaults, so a fresh DB "just works".
 */
export const SETTINGS = {
  appearance: {
    schema: z.object({
      accent: z.enum(ACCENT_IDS as [AccentId, ...AccentId[]]),
      wordmark: z.string().min(1).max(12),
      density: z.enum(["comfortable", "compact"]),
    }),
    defaults: {
      accent: themeConfig.defaultAccent,
      wordmark: themeConfig.wordmark,
      density: "comfortable" as const,
    },
  },
  featureFlags: {
    schema: z.record(z.string(), z.boolean()),
    defaults: {} as Record<string, boolean>,
  },
  "scoring.health": { schema: HealthWeightsSchema, defaults: DEFAULT_HEALTH_WEIGHTS },
  "scoring.whitespacePracticeWeights": {
    schema: z.record(z.string(), z.number().min(0).max(3)),
    defaults: Object.fromEntries(DEFAULT_PRACTICE_AREAS.map((p) => [p.id, 1])) as Record<
      string,
      number
    >,
  },
  "scoring.relevance": { schema: RelevanceConfigSchema, defaults: DEFAULT_RELEVANCE_CONFIG },
  "taxonomy.practiceAreas": {
    schema: z.array(
      z.object({ id: z.string(), label: z.string(), short: z.string(), description: z.string() }),
    ),
    defaults: DEFAULT_PRACTICE_AREAS,
  },
  "tagging.rules": { schema: z.array(TaggingRuleSchema), defaults: DEFAULT_TAGGING_RULES },
  "sources.enabled": {
    schema: z.record(z.string(), z.boolean()),
    defaults: {
      "google-news": true,
      "rss-news": true,
      "sec-edgar": true,
      greenhouse: true,
      lever: true,
      gdelt: false,
    } as Record<string, boolean>,
  },
  "scheduler.intervalMinutes": { schema: z.number().int().min(5).max(1440), defaults: 30 },
  /** Phase 6 enrichment: per-enricher on/off (missing = the enricher's default). */
  "enrichment.enabled": {
    schema: z.record(z.string(), z.boolean()),
    defaults: {} as Record<string, boolean>,
  },
  /** Fill EMPTY fields automatically with high-confidence public values (everything else is reviewed). */
  "enrichment.autoApply": { schema: z.boolean(), defaults: true },
  "enrichment.concurrency": { schema: z.number().int().min(1).max(4), defaults: 2 },
  "enrichment.paused": { schema: z.boolean(), defaults: false },
  /** Re-run enrichers for already-enriched accounts when their TTL expires. */
  "enrichment.autoRefresh": { schema: z.boolean(), defaults: true },
  "modules.settings": {
    schema: z.record(z.string(), z.record(z.string(), z.unknown())),
    defaults: {} as Record<string, Record<string, unknown>>,
  },
  "pipeline.lists": {
    schema: z.object({
      partners: z.array(z.string().min(1)).max(100),
      competitors: z.array(z.string().min(1)).max(100),
    }),
    defaults: {
      partners: [
        "Compute OEM A",
        "Compute OEM B",
        "Storage OEM",
        "Networking OEM",
        "Hyperscaler A",
        "Hyperscaler B",
        "Security ISV",
        "ITSM Platform",
        "GPU Vendor",
        "Cooling Vendor",
      ],
      competitors: [
        "National VAR",
        "Global SI",
        "Regional MSP",
        "OEM Direct",
        "Boutique Consultancy",
        "Cloud Native Partner",
      ],
    },
  },
  "ui.lastSeenAt": { schema: z.string().datetime().nullable(), defaults: null as string | null },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(k: string): k is SettingKey {
  return k in SETTINGS;
}
