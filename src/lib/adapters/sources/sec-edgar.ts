import { z } from "zod";
import type { SignalType } from "@/lib/domain/enums";
import { fetchJson } from "../http";
import {
  AdapterNotConfiguredError,
  type AdapterAccount,
  type DataAdapter,
  type NormalizedSignal,
} from "../types";

export const SubmissionsSchema = z.object({
  cik: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  filings: z.object({
    recent: z.object({
      accessionNumber: z.array(z.string()),
      filingDate: z.array(z.string()),
      form: z.array(z.string()),
      primaryDocument: z.array(z.string()),
      primaryDocDescription: z.array(z.string()).optional(),
      items: z.array(z.string()).optional(),
    }),
  }),
});
export type Submissions = z.infer<typeof SubmissionsSchema>;

export const TickerMapSchema = z.record(
  z.string(),
  z.object({ cik_str: z.number(), ticker: z.string(), title: z.string() }),
);

const FORMS = new Set(["8-K", "10-K", "10-Q", "8-K/A", "10-K/A"]);

/** 8-K item codes → human label + signal type. */
/** Material 8-K items surfaced as high-priority signals (executive change, M&A, cyber incident, major agreement). */
export const HIGH_PRIORITY_ITEMS = new Set(["1.01", "1.05", "2.01", "5.02"]);

export const EIGHT_K_ITEMS: Record<string, { label: string; type: SignalType }> = {
  "1.01": { label: "material definitive agreement", type: "partnership" },
  "1.05": { label: "material cybersecurity incident", type: "incident" },
  "2.01": { label: "completion of acquisition or disposition", type: "m-and-a" },
  "2.02": { label: "results of operations", type: "earnings" },
  "2.05": { label: "exit or restructuring costs", type: "filing" },
  "5.02": { label: "departure/appointment of officers or directors", type: "exec-change" },
  "7.01": { label: "Regulation FD disclosure", type: "filing" },
  "8.01": { label: "other events", type: "filing" },
};

export const padCik = (cik: string | number) => String(cik).padStart(10, "0");
export const filingUrl = (cik: string, accession: string, doc: string) =>
  `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${doc}`;

export const secEdgarAdapter: DataAdapter<NormalizedSignal, Submissions> = {
  id: "sec-edgar",
  label: "SEC EDGAR",
  kind: "public",
  description: "Recent 8-K / 10-K / 10-Q filings for accounts with a ticker (official EDGAR JSON).",
  rawSchema: SubmissionsSchema,
  eligible: (a) => !a.isDemo && !!(a.ticker || a.cik),
  async fetch(ctx) {
    const ua = ctx.env.secUserAgent;
    if (!ua)
      throw new AdapterNotConfiguredError(
        "sec-edgar",
        "set SEC_USER_AGENT in .env.local (descriptive name + contact email)",
      );
    const headers = { "user-agent": ua };
    const accounts = ctx.accounts.filter(this.eligible!);
    if (!accounts.length) return [];
    // SEC fair-access: ≤ 10 req/s — we stay well below.
    let tickerMap: Map<string, string> | null = null;
    const out: NormalizedSignal[] = [];
    for (const account of accounts) {
      let cik = account.cik;
      if (!cik && account.ticker) {
        if (!tickerMap) {
          const raw = TickerMapSchema.parse(
            await fetchJson("https://www.sec.gov/files/company_tickers.json", {
              db: ctx.db,
              ttlMs: 7 * 86_400_000,
              headers,
              minIntervalMs: 250,
              signal: ctx.signal,
            }),
          );
          tickerMap = new Map(
            Object.values(raw).map((r) => [r.ticker.toUpperCase(), padCik(r.cik_str)]),
          );
        }
        cik = tickerMap.get(account.ticker.toUpperCase().replace(".", "-")) ?? null;
        if (cik) await ctx.db.account.update({ where: { id: account.id }, data: { cik } });
        else {
          ctx.log(`sec-edgar: no CIK for ticker ${account.ticker}`);
          continue;
        }
      }
      const raw = SubmissionsSchema.parse(
        await fetchJson(`https://data.sec.gov/submissions/CIK${padCik(cik!)}.json`, {
          db: ctx.db,
          ttlMs: 60 * 60_000,
          headers,
          minIntervalMs: 250,
          signal: ctx.signal,
        }),
      );
      out.push(...this.normalize(raw, { account: { ...account, cik }, now: ctx.now }));
    }
    return out;
  },
  normalize(raw, { account, now }) {
    const r = raw.filings.recent;
    const cutoff = now.getTime() - 120 * 86_400_000;
    const out: NormalizedSignal[] = [];
    for (let i = 0; i < r.form.length && out.length < 15; i++) {
      const form = r.form[i];
      if (!FORMS.has(form)) continue;
      const filed = new Date(`${r.filingDate[i]}T12:00:00Z`);
      if (filed.getTime() < cutoff) continue;
      const items = (r.items?.[i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const known = items.map((c) => EIGHT_K_ITEMS[c]).filter(Boolean);
      const type: SignalType = form.startsWith("8-K")
        ? (known.find((k) => k.type !== "filing")?.type ?? "filing")
        : form.startsWith("10-")
          ? "earnings"
          : "filing";
      const what = form.startsWith("8-K")
        ? known.length
          ? known.map((k) => k.label).join("; ")
          : "current report"
        : form.startsWith("10-K")
          ? "annual report"
          : "quarterly report";
      out.push({
        accountId: account.id,
        type,
        title: `${account.name} files ${form}: ${what}`,
        summary:
          `SEC ${form} filed ${r.filingDate[i]}${items.length ? ` (items ${items.join(", ")})` : ""}. ${r.primaryDocDescription?.[i] ?? ""}`.trim(),
        url: filingUrl(raw.cik, r.accessionNumber[i], r.primaryDocument[i]),
        source: "sec-edgar",
        publishedAt: filed,
        dedupeKey: `sec:${r.accessionNumber[i]}`,
        ...(form.startsWith("8-K") && items.some((c) => HIGH_PRIORITY_ITEMS.has(c))
          ? { priority: "high" as const }
          : {}),
      });
    }
    return out;
  },
};

export type { AdapterAccount };
