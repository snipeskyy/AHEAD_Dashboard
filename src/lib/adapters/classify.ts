import type { SignalType } from "@/lib/domain/enums";

/** Transparent keyword rules for signal type (first match wins). */
export const SIGNAL_TYPE_RULES: Array<{ type: SignalType; pattern: RegExp }> = [
  {
    type: "m-and-a",
    pattern: /\b(acquir\w*|acquisition|merger|merge|to buy|takeover|divest\w*)\b/i,
  },
  {
    type: "exec-change",
    pattern:
      /\b(names|appoints?|appointed|hires|promotes?|steps? down|resign\w*|retire\w*|successor)\b.*\b(chief|ceo|cfo|cio|cto|ciso|coo|president|vp|vice president|head of)\b|\b(new|interim) (ceo|cfo|cio|cto|ciso)\b/i,
  },
  {
    type: "incident",
    pattern:
      /\b(outage|breach|ransomware|cyber ?attack|hack(ed|ers)?|data leak|disruption|incident)\b/i,
  },
  {
    type: "earnings",
    pattern:
      /\b(earnings|quarterly results|q[1-4] (results|revenue)|fiscal (q|quarter)|beats estimates|misses estimates|guidance)\b/i,
  },
  { type: "funding", pattern: /\b(raises \$|series [a-f]\b|funding round|venture funding|ipo)\b/i },
  {
    type: "partnership",
    pattern: /\b(partner(s|ship)?( with)?|collaborat\w+|alliance|teams up)\b/i,
  },
  {
    type: "regulatory",
    pattern: /\b(regulat\w+|fined?|settlement|lawsuit|compliance|antitrust|ftc|doj|sec charges)\b/i,
  },
  {
    type: "expansion",
    pattern:
      /\b(opens?|expands?|expansion|new (plant|facility|factory|headquarters|hq|data ?center|office|campus))\b/i,
  },
  { type: "hiring", pattern: /\b(hiring|job openings|recruit\w*|workforce expansion)\b/i },
];

export function classifySignalType(text: string, fallback: SignalType = "news"): SignalType {
  for (const r of SIGNAL_TYPE_RULES) if (r.pattern.test(text)) return r.type;
  return fallback;
}

/** Technology keywords seen in public job posts → tech-stack hypotheses (public evidence only). */
export const TECH_KEYWORDS: Array<{ pattern: RegExp; category: string; technology: string }> = [
  { pattern: /\bkubernetes|k8s|openshift\b/i, category: "Containers", technology: "Kubernetes" },
  {
    pattern: /\bterraform|ansible|infrastructure as code|iac\b/i,
    category: "Automation",
    technology: "Infrastructure as code",
  },
  { pattern: /\bservicenow\b/i, category: "ITSM", technology: "ServiceNow" },
  { pattern: /\baws|amazon web services\b/i, category: "Cloud", technology: "AWS" },
  { pattern: /\bazure\b/i, category: "Cloud", technology: "Microsoft Azure" },
  { pattern: /\bgcp|google cloud\b/i, category: "Cloud", technology: "Google Cloud" },
  {
    pattern: /\bgpu|cuda|hpc|nvidia|infiniband\b/i,
    category: "AI / ML",
    technology: "GPU / HPC infrastructure",
  },
  { pattern: /\bvmware|vsphere\b/i, category: "Virtualization", technology: "VMware" },
  { pattern: /\bsnowflake\b/i, category: "Data", technology: "Snowflake" },
  { pattern: /\bdatabricks|spark\b/i, category: "Data", technology: "Databricks / Spark" },
  {
    pattern: /\bsplunk|siem|soc analyst\b/i,
    category: "Security",
    technology: "SIEM / SOC tooling",
  },
  {
    pattern: /\bzero trust|okta|identity (and|&) access\b/i,
    category: "Security",
    technology: "Identity / zero trust",
  },
  {
    pattern: /\bdata center|datacenter|colocation\b/i,
    category: "Data center",
    technology: "On-prem data center operations",
  },
  {
    pattern: /\bnetwork engineer|cisco|arista|juniper\b/i,
    category: "Network",
    technology: "Enterprise networking",
  },
];

export function detectTech(text: string) {
  return TECH_KEYWORDS.filter((k) => k.pattern.test(text));
}
