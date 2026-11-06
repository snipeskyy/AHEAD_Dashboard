/**
 * Identity resolution: which legal entity is this account? Searches SEC, GLEIF, Wikidata and the company's own
 * website in parallel, links candidates that share identifiers, and scores them. Pure scoring/clustering is exported
 * for tests; nothing is saved until the user confirms (or a single candidate is unambiguous).
 */
import { normalizeDomain } from "@/lib/import/normalize";
import { normalizeLegalName } from "@/lib/import/values";
import { gleifPage, searchByName, summarize } from "./gleif";
import { companyPage, tickerTable } from "./sec";
import type { EnrichContext } from "./types";
import {
  bestClaim,
  claimString,
  getEntity,
  getLabels,
  claimItem,
  looksLikeOrg,
  search,
  wikidataPage,
} from "./wikidata";

export interface Candidate {
  key: string;
  label: string;
  facts: string[];
  identifiers: {
    cik?: string;
    ticker?: string;
    lei?: string;
    wikidataId?: string;
    domain?: string;
    legalName?: string;
  };
  sources: Array<{ source: string; url: string }>;
  score: number;
  reasons: string[];
}

export function nameSimilarity(a: string, b: string) {
  const ta = new Set(normalizeLegalName(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeLegalName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / new Set([...ta, ...tb]).size;
}

type Partial = Omit<Candidate, "key" | "score" | "reasons">;

/** Merge candidates that share any identifier (CIK, LEI, Wikidata id, ticker, domain). */
export function clusterCandidates(items: Partial[]): Partial[] {
  const out: Partial[] = [];
  const shares = (a: Partial["identifiers"], b: Partial["identifiers"]) =>
    (["cik", "lei", "wikidataId", "ticker", "domain"] as const).some(
      (k) => a[k] && b[k] && a[k]!.toLowerCase() === b[k]!.toLowerCase(),
    );
  for (const it of items) {
    const hit = out.find((o) => shares(o.identifiers, it.identifiers));
    if (!hit) {
      out.push({
        ...it,
        facts: [...it.facts],
        sources: [...it.sources],
        identifiers: { ...it.identifiers },
      });
      continue;
    }
    for (const [k, v] of Object.entries(it.identifiers))
      if (v && !hit.identifiers[k as keyof Partial["identifiers"]])
        (hit.identifiers as Record<string, string>)[k] = v;
    for (const f of it.facts) if (!hit.facts.includes(f)) hit.facts.push(f);
    for (const s of it.sources) if (!hit.sources.some((x) => x.url === s.url)) hit.sources.push(s);
  }
  return out;
}

export function scoreCandidate(
  c: Partial,
  account: { name: string; domain?: string | null; ticker?: string | null },
): Candidate {
  const reasons: string[] = [];
  const sim = Math.max(
    nameSimilarity(c.label, account.name),
    c.identifiers.legalName ? nameSimilarity(c.identifiers.legalName, account.name) : 0,
  );
  let score = sim * 60;
  reasons.push(`Name match ${Math.round(sim * 100)}%`);
  if (account.domain && c.identifiers.domain && c.identifiers.domain === account.domain) {
    score += 25;
    reasons.push("Website matches the account domain");
  }
  if (
    account.ticker &&
    c.identifiers.ticker &&
    c.identifiers.ticker.toUpperCase() === account.ticker.toUpperCase()
  ) {
    score += 25;
    reasons.push("Ticker matches");
  }
  const linked = new Set(c.sources.map((s) => s.source)).size;
  if (linked > 1) {
    score += 5 * (linked - 1);
    reasons.push(`Confirmed by ${linked} sources`);
  }
  return {
    ...c,
    key: c.identifiers.lei ?? c.identifiers.cik ?? c.identifiers.wikidataId ?? c.label,
    score: Math.min(100, Math.round(score)),
    reasons,
  };
}

/** A single strong candidate well ahead of the next is safe to suggest as the default choice. */
export function pickDefault(cs: Candidate[]) {
  const [a, b] = cs;
  return a && a.score >= 70 && (!b || a.score - b.score >= 20) ? a.key : null;
}

export async function findCandidates(
  ctx: Pick<EnrichContext, "http">,
  account: { name: string; domain?: string | null; ticker?: string | null },
  opts: { sec: boolean },
): Promise<{ candidates: Candidate[]; defaultKey: string | null; notes: string[] }> {
  const notes: string[] = [];
  const settle = async <T>(label: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (e) {
      notes.push(`${label} unavailable (${e instanceof Error ? e.message : "error"})`);
      return null;
    }
  };
  const target = normalizeLegalName(account.name);
  const [sec, gl, wd] = await Promise.all([
    opts.sec ? settle("SEC", tickerTable(ctx)) : Promise.resolve(null),
    settle("GLEIF", searchByName(ctx, account.name, 6)),
    settle("Wikidata", search(ctx, account.name, 6)),
  ]);
  if (!opts.sec)
    notes.push(
      "SEC search skipped: add SEC_USER_AGENT to .env.local to include public companies' CIK and ticker.",
    );
  const items: Partial[] = [];

  for (const r of (sec ?? [])
    .filter(
      (r) =>
        (account.ticker && r.ticker === account.ticker.toUpperCase()) ||
        nameSimilarity(r.title, account.name) >= 0.5,
    )
    .slice(0, 5))
    items.push({
      label: r.title,
      facts: [`SEC registrant · ticker ${r.ticker}`],
      identifiers: { cik: r.cik, ticker: r.ticker, legalName: r.title },
      sources: [{ source: "SEC", url: companyPage(r.cik) }],
    });

  for (const rec of gl ?? []) {
    const s = summarize(rec);
    if (!s.active || nameSimilarity(s.legalName, account.name) < 0.34) continue;
    items.push({
      label: s.legalName,
      facts: [
        [s.city, s.region ?? s.country].filter(Boolean).join(", "),
        `LEI ${s.lei}`,
        s.jurisdiction ? `Registered in ${s.jurisdiction}` : "",
      ].filter(Boolean),
      identifiers: { lei: s.lei, legalName: s.legalName },
      sources: [{ source: "GLEIF", url: gleifPage(s.lei) }],
    });
  }

  // Wikidata: read the top organization hits for cross-identifiers (LEI, CIK, website, country).
  for (const h of (wd ?? []).filter(looksLikeOrg).slice(0, 3)) {
    const e = await settle("Wikidata", getEntity(ctx, h.id));
    if (!e) continue;
    const country = claimItem(bestClaim(e, "P17"));
    const labels = country ? await settle("Wikidata", getLabels(ctx, [country])) : null;
    const site = claimString(bestClaim(e, "P856"));
    const cik = claimString(bestClaim(e, "P5531"));
    items.push({
      label: h.label,
      facts: [
        h.description ?? "",
        country && labels?.get(country) ? labels.get(country)! : "",
        site ?? "",
      ].filter(Boolean),
      identifiers: {
        wikidataId: h.id,
        lei: claimString(bestClaim(e, "P1278")) ?? undefined,
        cik: cik ? cik.padStart(10, "0") : undefined,
        domain: site ? (normalizeDomain(site) ?? undefined) : undefined,
      },
      sources: [{ source: "Wikidata", url: wikidataPage(h.id) }],
    });
  }

  const candidates = clusterCandidates(items)
    .map((c) => scoreCandidate(c, account))
    .filter((c) => c.score >= 20 || normalizeLegalName(c.label) === target)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return { candidates, defaultKey: pickDefault(candidates), notes };
}
