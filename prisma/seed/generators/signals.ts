import type { SignalType } from "../../../src/lib/domain/enums";
import { NAME_ROOTS } from "../names";
import type { Rng } from "../rng";

/**
 * Templated synthetic signals for FICTIONAL demo accounts. {n} = account name.
 * Phrases intentionally contain tagging-rule keywords so the tagging engine is exercised.
 */
const PHRASES = [
  "a multi-year cloud migration",
  "new AI infrastructure investment",
  "a data center consolidation plan",
  "a zero trust security program",
  "a ServiceNow rollout across IT",
  "a platform engineering team buildout",
  "an enterprise data platform modernization",
  "an expanded managed services agreement",
  "a rack-scale GPU deployment pilot",
  "a cloud cost reduction initiative led by FinOps",
  "liquid cooling upgrades for its primary data center",
  "a generative AI customer-service pilot",
  "a hybrid cloud strategy refresh",
  "a cyber resilience review after industry ransomware attacks",
  "a new regional distribution network",
  "a community grant program",
  "a sustainability report",
] as const;

const HIRING = [
  ["GPU/HPC engineers", "hiring"],
  ["cloud FinOps analysts", "hiring"],
  ["ServiceNow developers", "hiring"],
  ["SOC analysts for zero trust rollout", "hiring"],
  ["platform engineers (Kubernetes)", "hiring"],
  ["data engineers for lakehouse migration", "hiring"],
  ["data center facilities engineers", "hiring"],
  ["machine learning infrastructure engineers", "hiring"],
] as const;

const EXEC_TITLES = [
  "Chief Information Officer",
  "Chief Information Security Officer",
  "Chief Technology Officer",
  "VP of Infrastructure",
  "Chief Data Officer",
  "VP of Cloud Platform",
];

type Template = (rng: Rng, name: string, industry: string) => { title: string; summary: string };

const TEMPLATES: Record<SignalType, Template> = {
  news: (r, n) => {
    const p = r.pick(PHRASES);
    return {
      title: `${n} announces ${p}`,
      summary: `Trade press reports that ${n} is moving forward with ${p}. Timing and budget were not disclosed.`,
    };
  },
  filing: (r, n) => {
    const f = r.pick([
      ["8-K", "material agreement for data center services"],
      ["10-Q", "rising cloud spend called out in operating expenses"],
      ["10-K", "risk factors emphasize ransomware and cyber resilience"],
      ["8-K", "departure of Chief Information Officer"],
      ["10-K", "capital plan includes AI infrastructure and GPU capacity"],
    ] as const);
    return { title: `${n} ${f[0]}: ${f[1]}`, summary: `Filing (${f[0]}) notes ${f[1]}.` };
  },
  earnings: (r, n) => {
    const q = r.int(1, 4);
    const p = r.pick([
      "AI infrastructure investment",
      "cloud cost discipline",
      "data center consolidation savings",
      "cybersecurity spending",
      "automation-driven efficiency",
    ]);
    return {
      title: `${n} Q${q} results: management cites ${p}`,
      summary: `On the earnings call, leadership highlighted ${p} as a priority for the coming year.`,
    };
  },
  "exec-change": (r, n) => {
    const t = r.pick(EXEC_TITLES);
    return {
      title: `${n} names new ${t}`,
      summary: `${n} appointed a new ${t}. New leaders typically revisit technology roadmaps within 90–180 days.`,
    };
  },
  hiring: (r, n) => {
    const h = r.pick(HIRING);
    const c = r.int(3, 14);
    return {
      title: `${n} hiring ${c} ${h[0]}`,
      summary: `Public job postings show ${c} open roles for ${h[0]}.`,
    };
  },
  "m-and-a": (r, n) => {
    const target = `${r.pick(NAME_ROOTS)} ${r.pick(["Labs", "Group", "Holdings", "Partners"])}`;
    return {
      title: `${n} to acquire ${target}`,
      summary: `Integration of ${target} will require infrastructure, identity, and data platform consolidation.`,
    };
  },
  funding: (r, n) => {
    const amt = r.int(40, 400);
    return {
      title: `${n} raises $${amt}M to scale its AI platform`,
      summary: `New funding earmarked for AI infrastructure, GPU capacity, and go-to-market expansion.`,
    };
  },
  partnership: (r, n) => {
    const p = r.pick([
      "a cloud migration",
      "generative AI services",
      "data platform modernization",
      "managed security services",
    ]);
    return {
      title: `${n} partners with Hyperscaler A on ${p}`,
      summary: `Announced strategic collaboration covering ${p}.`,
    };
  },
  regulatory: (r, n, ind) => {
    const g = r.pick([
      "cyber incident reporting rules",
      "data residency requirements",
      "operational resilience guidance",
      "AI governance guidance",
    ]);
    return {
      title: `New ${g} affect ${ind} firms including ${n}`,
      summary: `Regulators issued ${g}; firms like ${n} may need to update controls and reporting.`,
    };
  },
  incident: (r, n) => {
    const i = r.pick([
      "a network outage",
      "a ransomware incident",
      "a data breach",
      "a multi-hour service disruption",
    ]);
    return {
      title: `${n} reports ${i} affecting operations`,
      summary: `${n} disclosed ${i}. Recovery and post-incident reviews typically drive resilience investment.`,
    };
  },
  expansion: (r, n) => {
    const e = r.pick([
      "a new regional headquarters",
      "a new manufacturing plant",
      "a new data center",
      "a new edge computing footprint across stores",
      "a new operations center",
    ]);
    return {
      title: `${n} opens ${e}`,
      summary: `${n} announced ${e}, implying new infrastructure, network, and security requirements.`,
    };
  },
};

const TYPE_WEIGHTS: ReadonlyArray<readonly [SignalType, number]> = [
  ["news", 30],
  ["hiring", 18],
  ["earnings", 7],
  ["filing", 7],
  ["exec-change", 6],
  ["partnership", 7],
  ["expansion", 7],
  ["incident", 5],
  ["regulatory", 5],
  ["m-and-a", 4],
  ["funding", 3],
];

export function generateSignalContent(rng: Rng, name: string, industry: string) {
  const type = rng.weighted(TYPE_WEIGHTS);
  // Funding is only plausible for tech companies; fall back to news otherwise.
  const t: SignalType = type === "funding" && industry !== "Technology" ? "news" : type;
  return { type: t, ...TEMPLATES[t](rng, name, industry) };
}
