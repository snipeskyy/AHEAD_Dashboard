/** Initiative themes mined from 10-K text. Rules are transparent: each hit cites its sentence and section. */
export interface Theme {
  id: string;
  title: string;
  practiceAreas: string[];
  patterns: RegExp[];
}

export const THEMES: Theme[] = [
  {
    id: "ai",
    title: "AI and accelerated computing",
    practiceAreas: ["ai-infra"],
    patterns: [
      /\bgenerative ai\b/i,
      /\bartificial intelligence\b/i,
      /\bmachine learning\b/i,
      /\blarge language models?\b/i,
      /\bGPUs?\b/,
      /\baccelerated computing\b/i,
    ],
  },
  {
    id: "data-center",
    title: "Data center capacity and modernization",
    practiceAreas: ["modern-dc"],
    patterns: [
      /\bdata cent(?:er|re)s?\b/i,
      /\bcolocation\b/i,
      /\bliquid cooling\b/i,
      /\bhigh-density\b/i,
    ],
  },
  {
    id: "consolidation",
    title: "Consolidation and rationalization",
    practiceAreas: ["modern-dc", "managed-services"],
    patterns: [
      /\bconsolidat\w* (?:of )?(?:our )?(?:data cent|facilit|systems|applications|platforms|operations)/i,
      /\brationaliz\w+/i,
      /\bfootprint reduction\b/i,
    ],
  },
  {
    id: "cloud",
    title: "Cloud migration and hybrid cloud",
    practiceAreas: ["cloud"],
    patterns: [
      /\bcloud migration\b/i,
      /\bmigrat\w+ (?:\w+ ){0,3}to the cloud\b/i,
      /\bhybrid cloud\b/i,
      /\bmulti-?cloud\b/i,
      /\bpublic cloud\b/i,
    ],
  },
  {
    id: "cost",
    title: "Cost reduction and efficiency programs",
    practiceAreas: ["cloud", "managed-services"],
    patterns: [
      /\bcost (?:reduction|savings|optimization) (?:program|initiative|plan)s?\b/i,
      /\boperational efficienc\w+ (?:program|initiative)s?\b/i,
      /\brestructuring (?:plan|program)\b/i,
    ],
  },
  {
    id: "security",
    title: "Cybersecurity and resilience",
    practiceAreas: ["security"],
    patterns: [
      /\bransomware\b/i,
      /\bzero trust\b/i,
      /\bsecurity operations cent(?:er|re)\b/i,
      /\bcyber ?resilien\w+/i,
      /\bthird-party (?:cyber|security) risk\b/i,
    ],
  },
  {
    id: "erp",
    title: "ERP and core system modernization",
    practiceAreas: ["data-analytics", "cloud"],
    patterns: [
      /\benterprise resource planning\b/i,
      /\bERP (?:system|implementation|transformation|upgrade)s?\b/,
      /\bS\/4HANA\b/i,
    ],
  },
  {
    id: "data",
    title: "Data platforms and analytics",
    practiceAreas: ["data-analytics"],
    patterns: [/\bdata (?:platform|analytics|lake|warehouse)s?\b/i, /\badvanced analytics\b/i],
  },
  {
    id: "automation",
    title: "Automation and digital transformation",
    practiceAreas: ["automation", "esm"],
    patterns: [
      /\bdigital transformation\b/i,
      /\bautomation (?:initiative|program|platform)s?\b/i,
      /\bIT service management\b/i,
    ],
  },
  {
    id: "mna",
    title: "M&A integration",
    practiceAreas: ["integration-facility"],
    patterns: [
      /\b(?:completed|announced|pending) (?:the )?acquisition of\b/i,
      /\bmerger agreement\b/i,
      /\bintegrat\w+ (?:of )?(?:the )?acquired\b/i,
    ],
  },
];

/** 10-K items we read. Only short snippets are stored, never whole sections. */
export const SECTIONS = [
  { id: "1", label: "Item 1 (Business)", re: /item\s*1\.?\s*business\b/gi },
  { id: "1A", label: "Item 1A (Risk Factors)", re: /item\s*1a\.?\s*risk\s+factors\b/gi },
  { id: "1C", label: "Item 1C (Cybersecurity)", re: /item\s*1c\.?\s*cybersecurity\b/gi },
  { id: "7", label: "Item 7 (MD&A)", re: /item\s*7\.?\s*management['’]?s\s+discussion\b/gi },
] as const;
