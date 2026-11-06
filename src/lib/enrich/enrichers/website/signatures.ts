/** Web technology fingerprints (headers + markup). Every match is a HYPOTHESIS with its evidence. */
export interface TechHit {
  category: string;
  technology: string;
  evidence: string;
  confidence: "medium" | "low";
}

const H: Array<{
  test: (h: Record<string, string>) => string | null;
  category: string;
  technology: string;
}> = [
  {
    test: (h) =>
      h["cf-ray"]
        ? "cf-ray header"
        : /cloudflare/i.test(h.server ?? "")
          ? `server: ${h.server}`
          : null,
    category: "CDN / edge",
    technology: "Cloudflare",
  },
  {
    test: (h) =>
      h["x-amz-cf-id"]
        ? "x-amz-cf-id header"
        : /cloudfront/i.test(h.via ?? "")
          ? "via: CloudFront"
          : null,
    category: "CDN / edge",
    technology: "Amazon CloudFront",
  },
  {
    test: (h) =>
      Object.keys(h).some((k) => k.startsWith("x-akamai")) || h["akamai-grn"]
        ? "Akamai headers"
        : /akamai/i.test(h.server ?? "")
          ? `server: ${h.server}`
          : null,
    category: "CDN / edge",
    technology: "Akamai",
  },
  {
    test: (h) => (h["x-azure-ref"] ? "x-azure-ref header" : null),
    category: "CDN / edge",
    technology: "Azure Front Door",
  },
  {
    test: (h) =>
      /fastly/i.test(`${h["x-served-by"] ?? ""} ${h.via ?? ""}`) || h["x-fastly-request-id"]
        ? "Fastly headers"
        : null,
    category: "CDN / edge",
    technology: "Fastly",
  },
  {
    test: (h) => (h["x-vercel-id"] ? "x-vercel-id header" : null),
    category: "Hosting / cloud",
    technology: "Vercel",
  },
  {
    test: (h) => (h["x-nf-request-id"] ? "x-nf-request-id header" : null),
    category: "Hosting / cloud",
    technology: "Netlify",
  },
  {
    test: (h) => (/AmazonS3/i.test(h.server ?? "") ? `server: ${h.server}` : null),
    category: "Hosting / cloud",
    technology: "AWS (S3)",
  },
  {
    test: (h) => (/Google Frontend|gws/i.test(h.server ?? "") ? `server: ${h.server}` : null),
    category: "Hosting / cloud",
    technology: "Google Cloud",
  },
  {
    test: (h) =>
      /Microsoft-IIS/i.test(h.server ?? "")
        ? `server: ${h.server}`
        : /ASP\.NET/i.test(h["x-powered-by"] ?? "")
          ? `x-powered-by: ${h["x-powered-by"]}`
          : null,
    category: "Web platform / CMS",
    technology: "Microsoft IIS / ASP.NET",
  },
  {
    test: (h) =>
      h["x-drupal-cache"] || /drupal/i.test(h["x-generator"] ?? "") ? "Drupal headers" : null,
    category: "Web platform / CMS",
    technology: "Drupal",
  },
  {
    test: (h) => (h["x-shopify-stage"] ? "x-shopify-stage header" : null),
    category: "Web platform / CMS",
    technology: "Shopify",
  },
];

const M: Array<{ re: RegExp; category: string; technology: string; label: string }> = [
  {
    re: /\/wp-content\/|\/wp-includes\//i,
    category: "Web platform / CMS",
    technology: "WordPress",
    label: "/wp-content/ assets",
  },
  {
    re: /\/etc\.clientlibs\/|\/content\/dam\//i,
    category: "Web platform / CMS",
    technology: "Adobe Experience Manager",
    label: "AEM clientlibs/DAM paths",
  },
  {
    re: /sitecore/i,
    category: "Web platform / CMS",
    technology: "Sitecore",
    label: "Sitecore markup",
  },
  {
    re: /Drupal\.settings|\/sites\/default\/files\//i,
    category: "Web platform / CMS",
    technology: "Drupal",
    label: "Drupal assets",
  },
  {
    re: /ctfassets\.net|contentful/i,
    category: "Web platform / CMS",
    technology: "Contentful",
    label: "Contentful assets",
  },
  {
    re: /\/_next\/static\//i,
    category: "Web platform / CMS",
    technology: "Next.js",
    label: "/_next/static assets",
  },
  {
    re: /js\.hs-scripts\.com|js\.hsforms\.net|hubspot/i,
    category: "Marketing automation",
    technology: "HubSpot",
    label: "HubSpot scripts",
  },
  {
    re: /munchkin\.marketo\.net|mktoForms/i,
    category: "Marketing automation",
    technology: "Adobe Marketo Engage",
    label: "Marketo Munchkin",
  },
  {
    re: /pi\.pardot\.com|go\.pardot\.com/i,
    category: "Marketing automation",
    technology: "Salesforce Account Engagement (Pardot)",
    label: "Pardot tracker",
  },
  {
    re: /\.en25\.com|eloqua/i,
    category: "Marketing automation",
    technology: "Oracle Eloqua",
    label: "Eloqua tracker",
  },
  {
    re: /googletagmanager\.com\/gtm\.js/i,
    category: "Analytics / tags",
    technology: "Google Tag Manager",
    label: "GTM container",
  },
  {
    re: /assets\.adobedtm\.com/i,
    category: "Analytics / tags",
    technology: "Adobe Experience Platform Tags",
    label: "Adobe Launch",
  },
  {
    re: /cdn\.cookielaw\.org|onetrust/i,
    category: "Privacy / consent",
    technology: "OneTrust",
    label: "OneTrust consent",
  },
  {
    re: /consent\.trustarc\.com|trustarc/i,
    category: "Privacy / consent",
    technology: "TrustArc",
    label: "TrustArc consent",
  },
  {
    re: /js\.driftt\.com|drift\.com/i,
    category: "Marketing automation",
    technology: "Drift",
    label: "Drift widget",
  },
  {
    re: /widget\.intercom\.io/i,
    category: "Support / chat",
    technology: "Intercom",
    label: "Intercom widget",
  },
  {
    re: /\.zendesk\.com/i,
    category: "ITSM / support",
    technology: "Zendesk",
    label: "links to zendesk.com",
  },
  {
    re: /\.service-now\.com/i,
    category: "ITSM / support",
    technology: "ServiceNow",
    label: "links to service-now.com",
  },
  {
    re: /\.my\.site\.com|\.force\.com/i,
    category: "CRM / portals",
    technology: "Salesforce Experience Cloud",
    label: "links to Salesforce sites",
  },
  {
    re: /\.okta\.com|\.oktapreview\.com/i,
    category: "Identity",
    technology: "Okta",
    label: "links to okta.com",
  },
  {
    re: /login\.microsoftonline\.com/i,
    category: "Identity",
    technology: "Microsoft Entra ID",
    label: "Microsoft login links",
  },
  {
    re: /myworkdayjobs\.com|\.wd\d+\.myworkday/i,
    category: "HR / recruiting",
    technology: "Workday",
    label: "Workday careers links",
  },
  {
    re: /taleo\.net/i,
    category: "HR / recruiting",
    technology: "Oracle Taleo",
    label: "Taleo careers links",
  },
  {
    re: /icims\.com/i,
    category: "HR / recruiting",
    technology: "iCIMS",
    label: "iCIMS careers links",
  },
  {
    re: /successfactors|jobs\.sap\.com/i,
    category: "HR / recruiting",
    technology: "SAP SuccessFactors",
    label: "SuccessFactors careers links",
  },
];

export function detectWebTech(headers: Record<string, string>, html: string): TechHit[] {
  const out: TechHit[] = [];
  for (const s of H) {
    const ev = s.test(headers);
    if (ev)
      out.push({
        category: s.category,
        technology: s.technology,
        evidence: ev,
        confidence: "medium",
      });
  }
  for (const s of M)
    if (s.re.test(html) && !out.some((o) => o.technology === s.technology))
      out.push({
        category: s.category,
        technology: s.technology,
        evidence: s.label,
        confidence: "low",
      });
  return out;
}
