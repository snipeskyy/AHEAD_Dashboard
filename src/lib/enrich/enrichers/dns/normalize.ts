import type { ProposalInput } from "../../types";

/** DNS footprint → tech-stack HYPOTHESES. A verification record means a service was set up, not that it's in use. */
const MX: Array<{ re: RegExp; category: string; technology: string }> = [
  {
    re: /\.mail\.protection\.outlook\.com\.?$/i,
    category: "Email & collaboration",
    technology: "Microsoft 365",
  },
  {
    re: /(aspmx\.l\.google\.com|googlemail\.com|smtp\.google\.com)\.?$/i,
    category: "Email & collaboration",
    technology: "Google Workspace",
  },
  { re: /pphosted\.com\.?$/i, category: "Email security", technology: "Proofpoint" },
  { re: /mimecast\.com\.?$/i, category: "Email security", technology: "Mimecast" },
  { re: /iphmx\.com\.?$/i, category: "Email security", technology: "Cisco Secure Email" },
  { re: /barracudanetworks\.com\.?$/i, category: "Email security", technology: "Barracuda" },
  {
    re: /messagelabs\.com\.?$/i,
    category: "Email security",
    technology: "Broadcom Email Security.cloud",
  },
];
const SPF: Array<{ re: RegExp; category: string; technology: string }> = [
  {
    re: /spf\.protection\.outlook\.com/i,
    category: "Email & collaboration",
    technology: "Microsoft 365",
  },
  { re: /_spf\.google\.com/i, category: "Email & collaboration", technology: "Google Workspace" },
  { re: /_spf\.salesforce\.com/i, category: "CRM", technology: "Salesforce" },
  { re: /service-now\.com/i, category: "ITSM", technology: "ServiceNow" },
  { re: /mail\.zendesk\.com/i, category: "Customer service", technology: "Zendesk" },
  { re: /sendgrid\.net/i, category: "Email delivery", technology: "Twilio SendGrid" },
  { re: /mailgun\.org/i, category: "Email delivery", technology: "Mailgun" },
  { re: /amazonses\.com/i, category: "Email delivery", technology: "Amazon SES" },
  { re: /mktomail\.com/i, category: "Marketing automation", technology: "Adobe Marketo Engage" },
  {
    re: /hubspotemail\.net|_spf\.hubspot/i,
    category: "Marketing automation",
    technology: "HubSpot",
  },
  { re: /\.en25\.com/i, category: "Marketing automation", technology: "Oracle Eloqua" },
  { re: /pphosted\.com/i, category: "Email security", technology: "Proofpoint" },
  { re: /docusign\.net/i, category: "Digital agreements", technology: "DocuSign" },
  { re: /atlassian\.net/i, category: "Collaboration / DevOps", technology: "Atlassian" },
];
const VERIFY: Array<{ re: RegExp; category: string; technology: string }> = [
  { re: /^MS=ms\d+/i, category: "Email & collaboration", technology: "Microsoft 365" },
  {
    re: /^atlassian-domain-verification=/i,
    category: "Collaboration / DevOps",
    technology: "Atlassian",
  },
  { re: /^docusign=/i, category: "Digital agreements", technology: "DocuSign" },
  {
    re: /^adobe-idp-site-verification=/i,
    category: "Creative / document cloud",
    technology: "Adobe",
  },
  {
    re: /^apple-domain-verification=/i,
    category: "Device management",
    technology: "Apple Business Manager",
  },
  { re: /^ZOOM_verify_/i, category: "Communications", technology: "Zoom" },
  {
    re: /^(cisco-ci-domain-verification|webexdomainverification)/i,
    category: "Communications",
    technology: "Cisco Webex",
  },
  { re: /^slack-domain-verification=/i, category: "Communications", technology: "Slack" },
  {
    re: /^dropbox-domain-verification=/i,
    category: "Content collaboration",
    technology: "Dropbox",
  },
  { re: /^box-domain-verification=/i, category: "Content collaboration", technology: "Box" },
  { re: /^onetrust-domain-verification=/i, category: "Privacy / consent", technology: "OneTrust" },
  { re: /^citrix-verification-code=/i, category: "End-user computing", technology: "Citrix" },
  { re: /^smartsheet-site-validation=/i, category: "Work management", technology: "Smartsheet" },
  { re: /^miro-verification=/i, category: "Work management", technology: "Miro" },
  { re: /^lucid-verification=/i, category: "Work management", technology: "Lucid" },
  { re: /^knowbe4-site-verification=/i, category: "Security awareness", technology: "KnowBe4" },
  { re: /^dynatrace-site-verification=/i, category: "Observability", technology: "Dynatrace" },
  { re: /^teamviewer-sso-verification=/i, category: "Remote access", technology: "TeamViewer" },
  { re: /^logmein-verification-code=/i, category: "Remote access", technology: "GoTo (LogMeIn)" },
  { re: /^openai-domain-verification=/i, category: "AI services", technology: "OpenAI" },
];

export interface DnsAnswer {
  type: number;
  data: string;
}

export const dnsViewer = (domain: string, rr: "MX" | "TXT") =>
  `https://dns.google/query?name=${encodeURIComponent(domain)}&rr_type=${rr}`;

export function normalizeDns(domain: string, mx: DnsAnswer[], txt: DnsAnswer[]): ProposalInput[] {
  const found = new Map<string, ProposalInput>();
  const add = (
    category: string,
    technology: string,
    evidence: string,
    rr: "MX" | "TXT",
    confidence: "high" | "medium",
  ) => {
    const key = `tech:${category}:${technology}`;
    const prev = found.get(key);
    if (prev && prev.confidence === "high") return;
    found.set(key, {
      field: key,
      value: { category, technology, kind: "dns" },
      sourceUrl: dnsViewer(domain, rr),
      confidence,
      evidenceSnippet: `Hypothesis from public DNS: ${evidence}`,
      source: "Public DNS",
    });
  };
  for (const a of mx.filter((x) => x.type === 15)) {
    const host = a.data.split(/\s+/).pop() ?? "";
    for (const r of MX)
      if (r.re.test(host))
        add(r.category, r.technology, `MX → ${host.replace(/\.$/, "")}`, "MX", "high");
  }
  for (const a of txt.filter((x) => x.type === 16)) {
    const v = a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
    if (/^v=spf1/i.test(v)) {
      for (const inc of v.match(/include:\S+/gi) ?? [])
        for (const r of SPF)
          if (r.re.test(inc)) add(r.category, r.technology, `SPF ${inc}`, "TXT", "medium");
    } else
      for (const r of VERIFY)
        if (r.re.test(v))
          add(
            r.category,
            r.technology,
            `TXT ${v.split("=")[0]} verification record`,
            "TXT",
            "medium",
          );
  }
  return [...found.values()];
}
