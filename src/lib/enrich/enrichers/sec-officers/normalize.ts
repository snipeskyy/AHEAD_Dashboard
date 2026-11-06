import { decodeEntities } from "../../html";
import type { ProposalInput } from "../../types";

export interface Officer {
  ownerCik: string;
  name: string;
  title: string;
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`, "i").exec(xml);
  return m ? decodeEntities(m[1].trim()) : null;
};

/** SEC lists reporting owners as "LAST FIRST MIDDLE"; show them as "First Middle Last". */
export function displayName(secName: string) {
  const parts = secName.replace(/\s+/g, " ").trim().split(" ");
  const ordered = parts.length > 1 ? [...parts.slice(1), parts[0]] : parts;
  return ordered
    .map((p) =>
      p.length <= 2 && /^[A-Z]\.?$/i.test(p)
        ? p.toUpperCase().replace(/^([A-Z])$/, "$1.")
        : p[0].toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** Officers (not directors-only) from one Form 3/4/5 XML document. */
export function parseOwnershipXml(xml: string): Officer[] {
  const out: Officer[] = [];
  for (const m of xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/gi)) {
    const block = m[1];
    const isOfficer = /^(1|true)$/i.test(tag(block, "isOfficer") ?? "");
    const title = tag(block, "officerTitle");
    const name = tag(block, "rptOwnerName");
    const ownerCik = tag(block, "rptOwnerCik");
    if (isOfficer && title && name && ownerCik)
      out.push({ ownerCik, name: displayName(name), title });
  }
  return out;
}

export function officerProposals(
  found: Array<Officer & { url: string; filed: string; form: string }>,
): ProposalInput[] {
  const seen = new Map<string, (typeof found)[number]>();
  for (const o of found) if (!seen.has(o.ownerCik)) seen.set(o.ownerCik, o); // newest first
  const out: ProposalInput[] = [];
  for (const o of seen.values()) {
    out.push({
      field: `contact:${o.ownerCik}`,
      value: { name: o.name, title: o.title, function: "Executive" },
      sourceUrl: o.url,
      confidence: "high",
      evidenceSnippet: `Form ${o.form} filed ${o.filed}: officer title "${o.title}"`,
      source: "SEC insider filings",
    });
    if (/chief executive|\bceo\b/i.test(o.title))
      out.push({
        field: "firmographics.ceo",
        value: o.name,
        sourceUrl: o.url,
        confidence: "medium",
        evidenceSnippet: `Form ${o.form}: ${o.title}`,
      });
  }
  return out;
}
