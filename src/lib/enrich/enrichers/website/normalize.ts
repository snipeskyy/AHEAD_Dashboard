import { anchors, jsonLd, linkTags, metaContent } from "../../html";
import type { JobBoardProvider, ProposalInput } from "../../types";
import { detectWebTech } from "./signatures";

const BOARD: Array<{ provider: JobBoardProvider; re: RegExp }> = [
  {
    provider: "greenhouse",
    re: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i,
  },
  { provider: "lever", re: /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i },
  { provider: "ashby", re: /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i },
  { provider: "smartrecruiters", re: /(?:jobs|careers)\.smartrecruiters\.com\/([a-z0-9_-]+)/i },
];
const SOCIAL: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/company\//i,
  x: /(?:twitter|x)\.com\/(?!intent|share)[a-z0-9_]+\/?$/i,
  youtube: /youtube\.com\/(?:c\/|channel\/|user\/|@)/i,
  facebook: /facebook\.com\/(?!sharer)[a-z0-9.]+\/?$/i,
  instagram: /instagram\.com\/[a-z0-9_.]+\/?$/i,
};

export function detectJobBoard(html: string): { provider: JobBoardProvider; slug: string } | null {
  for (const b of BOARD) {
    const m = b.re.exec(html);
    if (m && !/^(embed|jobs|v1|api)$/i.test(m[1]))
      return { provider: b.provider, slug: m[1].toLowerCase() };
  }
  return null;
}

const ORG_TYPES =
  /^(Organization|Corporation|LocalBusiness|Company|NGO|GovernmentOrganization|EducationalOrganization)$/i;

/** Homepage → proposals. Pure; `url` is the final (post-redirect) URL. */
export function normalizeHomepage(page: {
  url: string;
  html: string;
  headers: Record<string, string>;
}) {
  const { url, html, headers } = page;
  const out: ProposalInput[] = [];
  const org = jsonLd(html).find((o) => [o["@type"]].flat().some((t) => ORG_TYPES.test(String(t))));
  const desc =
    (org?.description as string) ||
    metaContent(html, "description") ||
    metaContent(html, "og:description");
  if (desc && desc.length >= 30)
    out.push({
      field: "firmographics.description",
      value: desc.slice(0, 600),
      sourceUrl: url,
      confidence: org?.description ? "high" : "medium",
      evidenceSnippet: org?.description ? "schema.org Organization" : "meta description",
    });
  const legal = (org?.legalName as string) ?? null;
  if (legal)
    out.push({
      field: "identity.legalName",
      value: legal,
      sourceUrl: url,
      confidence: "medium",
      evidenceSnippet: "schema.org legalName",
    });
  const addr = (org?.address ?? null) as Record<string, string> | null;
  if (addr && typeof addr === "object" && (addr.addressLocality || addr.streetAddress))
    out.push({
      field: "firmographics.hqAddress",
      value: {
        lines: addr.streetAddress ? [addr.streetAddress] : [],
        city: addr.addressLocality ?? null,
        region: addr.addressRegion ?? null,
        postalCode: addr.postalCode ?? null,
        country:
          (typeof addr.addressCountry === "object"
            ? (addr.addressCountry as unknown as { name?: string }).name
            : addr.addressCountry) ?? null,
      },
      sourceUrl: url,
      confidence: "medium",
      evidenceSnippet: "schema.org PostalAddress",
    });

  const links = anchors(html, url);
  const own = new URL(url).hostname.replace(/^www\./, "");
  const pick = (re: RegExp, textRe: RegExp) =>
    links.find((l) => re.test(l.href) && (l.href.includes(own) || !/^https?:/i.test(l.href)))
      ?.href ??
    links.find((l) => textRe.test(l.text))?.href ??
    null;
  const careers = pick(
    /\/(careers?|jobs|join-us|work-with-us)(\/|$|\?)/i,
    /^(careers?|jobs|join (us|our team))$/i,
  );
  const news = pick(
    /\/(news(room)?|press(-releases|room)?|media)(\/|$|\?)/i,
    /^(news(room)?|press( releases| room)?|media)$/i,
  );
  const ir =
    links.find(
      (l) => /investor|\/ir(\/|$)/i.test(l.href) || /^investors?( relations)?$/i.test(l.text),
    )?.href ?? null;
  if (careers)
    out.push({ field: "web.careersUrl", value: careers, sourceUrl: url, confidence: "medium" });
  if (news)
    out.push({ field: "web.newsroomUrl", value: news, sourceUrl: url, confidence: "medium" });
  if (ir) out.push({ field: "web.investorUrl", value: ir, sourceUrl: url, confidence: "medium" });

  const feed = linkTags(html).find(
    (l) => l.rel.includes("alternate") && /rss|atom/.test(l.type) && l.href,
  );
  if (feed?.href)
    out.push({
      field: "web.newsroomRss",
      value: new URL(feed.href, url).toString(),
      sourceUrl: url,
      confidence: "high",
      evidenceSnippet: "<link rel=alternate> RSS/Atom feed",
    });

  const board = detectJobBoard(html);
  if (board)
    out.push({
      field: "web.jobBoard",
      value: board,
      sourceUrl: url,
      confidence: "high",
      evidenceSnippet: `Link to ${board.provider} board "${board.slug}"`,
    });

  const social: Record<string, string> = {};
  for (const l of [
    ...links.map((x) => x.href),
    ...[org?.sameAs].flat().filter((x): x is string => typeof x === "string"),
  ])
    for (const [k, re] of Object.entries(SOCIAL)) if (!social[k] && re.test(l)) social[k] = l;
  if (Object.keys(social).length)
    out.push({ field: "web.social", value: social, sourceUrl: url, confidence: "medium" });

  for (const t of detectWebTech(headers, html))
    out.push({
      field: `tech:${t.category}:${t.technology}`,
      value: { category: t.category, technology: t.technology, kind: "web" },
      sourceUrl: url,
      confidence: t.confidence,
      evidenceSnippet: `Hypothesis from the public website: ${t.evidence}`,
      source: "Website (tech)",
    });
  return { proposals: out, careersUrl: careers, hasBoard: !!board };
}
