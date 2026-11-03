import { z } from "zod";

/**
 * Transparent keyword → practice-area tagging rules. Editable in Settings
 * (Setting key "tagging.rules"); these are the defaults.
 */
export const TaggingRuleSchema = z.object({
  practiceArea: z.string(),
  keywords: z.array(z.string().min(1)),
});
export type TaggingRule = z.infer<typeof TaggingRuleSchema>;

export const DEFAULT_TAGGING_RULES: TaggingRule[] = [
  {
    practiceArea: "ai-infra",
    keywords: [
      "GPU",
      "AI factory",
      "inference",
      "HPC",
      "machine learning",
      "LLM",
      "generative AI",
      "AI infrastructure",
      "accelerated computing",
      "AI cluster",
      "model training",
    ],
  },
  {
    practiceArea: "modern-dc",
    keywords: [
      "data center consolidation",
      "data center",
      "colocation",
      "liquid cooling",
      "hyperconverged",
      "storage refresh",
      "network refresh",
      "hardware refresh",
      "rack density",
      "server refresh",
      "edge computing",
    ],
  },
  {
    practiceArea: "cloud",
    keywords: [
      "FinOps",
      "cloud spend",
      "cloud migration",
      "cloud cost",
      "multi-cloud",
      "hybrid cloud",
      "landing zone",
      "public cloud",
      "cloud-first",
    ],
  },
  {
    practiceArea: "data-analytics",
    keywords: [
      "data platform",
      "analytics",
      "data governance",
      "data lake",
      "lakehouse",
      "business intelligence",
      "data warehouse",
      "data modernization",
    ],
  },
  {
    practiceArea: "security",
    keywords: [
      "ransomware",
      "breach",
      "zero trust",
      "cyberattack",
      "cybersecurity",
      "SOC",
      "incident response",
      "vulnerability",
      "identity security",
      "cyber resilience",
    ],
  },
  {
    practiceArea: "automation",
    keywords: [
      "platform engineering",
      "DevOps",
      "infrastructure as code",
      "Kubernetes",
      "automation",
      "developer platform",
      "CI/CD",
      "site reliability",
    ],
  },
  {
    practiceArea: "esm",
    keywords: [
      "ServiceNow",
      "ITSM",
      "service management",
      "IT service",
      "workflow automation",
      "ITOM",
      "help desk",
    ],
  },
  {
    practiceArea: "managed-services",
    keywords: [
      "managed services",
      "outsourcing",
      "operations support",
      "staff shortage",
      "24x7",
      "managed service provider",
    ],
  },
  {
    practiceArea: "integration-facility",
    keywords: [
      "rack-scale",
      "pre-integrated",
      "integrated racks",
      "rapid deployment",
      "supply chain",
      "lead times",
      "rack and stack",
    ],
  },
];

export interface TagHit {
  practiceArea: string;
  keyword: string;
}

export interface TagResult {
  tags: string[];
  hits: TagHit[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();
function keywordRegex(keyword: string): RegExp {
  let re = cache.get(keyword);
  if (!re) {
    // Word-boundary match, case-insensitive; allows plural "s".
    re = new RegExp(`(^|[^a-z0-9])${escape(keyword.toLowerCase())}s?(?=$|[^a-z0-9])`, "i");
    cache.set(keyword, re);
  }
  return re;
}

/** Tags text with practice areas. Pure and deterministic; ordering follows rule order. */
export function tagText(text: string, rules: TaggingRule[] = DEFAULT_TAGGING_RULES): TagResult {
  const hits: TagHit[] = [];
  const lower = text.toLowerCase();
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (keywordRegex(kw).test(lower)) hits.push({ practiceArea: rule.practiceArea, keyword: kw });
    }
  }
  const tags = [...new Set(hits.map((h) => h.practiceArea))];
  return { tags, hits };
}

/** Denormalized ",tag1,tag2," string for portable LIKE filtering (see Signal.tagIndex). */
export const toTagIndex = (tags: string[]) => (tags.length ? `,${tags.join(",")},` : "");
