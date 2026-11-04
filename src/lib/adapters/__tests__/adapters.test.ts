import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { classifySignalType, detectTech } from "../classify";
import { dedupeHash, normalizeUrl } from "../dedupe";
import { __resetRateLimiter, backoffDelay, fetchText } from "../http";
import { parseFeed } from "../rss";
import { gdeltAdapter, parseGdeltDate } from "../sources/gdelt";
import { googleNewsAdapter, googleNewsUrl, splitPublisher } from "../sources/google-news";
import { GreenhouseSchema, greenhouseAdapter } from "../sources/greenhouse";
import { LeverSchema, leverAdapter } from "../sources/lever";
import { crmPlaceholderAdapter } from "../sources/crm-placeholder";
import { filingUrl, secEdgarAdapter, SubmissionsSchema } from "../sources/sec-edgar";
import { AdapterNotConfiguredError, type AdapterAccount } from "../types";

const fx = (f: string) => readFileSync(path.join(__dirname, "..", "__fixtures__", f), "utf8");
const now = new Date("2026-11-03T18:00:00Z");
const account: AdapterAccount = {
  id: "acc1",
  name: "Halvorsen Mutual",
  domain: "halvorsen.example",
  ticker: "HLVM",
  cik: "0000000042",
  isDemo: false,
  tier: "Strategic",
  sourceConfig: { googleNews: true, greenhouseSlug: "example", leverSlug: "example" },
};

describe("RSS / Google News", () => {
  it("parses RSS items with dates and strips publisher suffix", () => {
    const items = parseFeed(fx("google-news.xml"));
    expect(items).toHaveLength(4);
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-02T12:15:35.000Z");
    expect(splitPublisher("Big news today - Yahoo Finance")).toEqual({
      title: "Big news today",
      publisher: "Yahoo Finance",
    });
    expect(splitPublisher("No publisher")).toEqual({ title: "No publisher", publisher: null });
  });
  it("normalizes into signals for the account", () => {
    const out = googleNewsAdapter.normalize(parseFeed(fx("google-news.xml")), { account, now });
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({
      accountId: "acc1",
      source: "google-news",
      summary: "Reported by Yahoo Finance.",
    });
    expect(out[0].title.endsWith("Yahoo Finance")).toBe(false);
    expect(out[0].url).toMatch(/^https:\/\/news\.google\.com\//);
  });
  it("builds a quoted search URL without legal suffixes", () => {
    expect(googleNewsUrl({ ...account, name: "Halvorsen Mutual Inc." })).toContain(
      encodeURIComponent('"Halvorsen Mutual"'),
    );
  });
  it("only applies to real accounts with news enabled", () => {
    expect(googleNewsAdapter.eligible!(account)).toBe(true);
    expect(googleNewsAdapter.eligible!({ ...account, isDemo: true })).toBe(false);
    expect(googleNewsAdapter.eligible!({ ...account, sourceConfig: { googleNews: false } })).toBe(
      false,
    );
  });
  it("parses Atom feeds", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom &amp; item</title><link rel="alternate" href="https://ex.com/a"/><updated>2026-11-01T00:00:00Z</updated><summary>&lt;p&gt;Hello&lt;/p&gt;</summary></entry></feed>`;
    expect(parseFeed(atom)).toEqual([
      {
        title: "Atom & item",
        link: "https://ex.com/a",
        publishedAt: new Date("2026-11-01T00:00:00Z"),
        description: "Hello",
        sourceName: null,
      },
    ]);
  });
});

describe("SEC EDGAR", () => {
  const raw = SubmissionsSchema.parse(JSON.parse(fx("sec-submissions.json")));
  it("keeps only 8-K/10-K/10-Q within the window and maps 8-K items", () => {
    const out = secEdgarAdapter.normalize(raw, { account, now });
    expect(out.map((s) => s.type)).toEqual(["earnings", "exec-change"]);
    expect(out[0].title).toBe(
      "Halvorsen Mutual files 8-K: results of operations; Regulation FD disclosure",
    );
    expect(out[0].url).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/42\/\d+\/hlvm-/);
    expect(out[0].dedupeKey).toMatch(/^sec:/);
  });
  it("builds archive URLs", () => {
    expect(filingUrl("0000018230", "0000018230-26-000052", "x.htm")).toBe(
      "https://www.sec.gov/Archives/edgar/data/18230/000001823026000052/x.htm",
    );
  });
  it("refuses to run without SEC_USER_AGENT", async () => {
    await expect(
      secEdgarAdapter.fetch({
        db: {} as never,
        accounts: [account],
        now,
        env: { secUserAgent: null },
        log: () => {},
      }),
    ).rejects.toBeInstanceOf(AdapterNotConfiguredError);
  });
});

describe("job boards", () => {
  it("rolls Greenhouse postings into one hiring signal per practice with evidence", () => {
    const out = greenhouseAdapter.normalize(
      GreenhouseSchema.parse(JSON.parse(fx("greenhouse.json"))),
      { account, now },
    );
    const ai = out.find((s) => s.title.includes("AI Infrastructure"))!;
    expect(ai).toBeTruthy();
    expect(ai.type).toBe("hiring");
    expect(ai.title).toMatch(/^Halvorsen Mutual hiring \d+ roles? related to AI Infrastructure$/);
    expect(ai.dedupeKey).toMatch(/^greenhouse:ai-infra:2026-W\d+$/);
    expect(
      ai.evidence?.some((e) => e.kind === "initiative" && e.practiceAreas.includes("ai-infra")),
    ).toBe(true);
    expect(
      ai.evidence?.some((e) => e.kind === "tech" && e.technology === "GPU / HPC infrastructure"),
    ).toBe(true);
    expect(out.find((s) => s.title.includes("Enterprise Service Management"))).toBeTruthy();
  });
  it("rolls Lever postings the same way", () => {
    const out = leverAdapter.normalize(LeverSchema.parse(JSON.parse(fx("lever.json"))), {
      account,
      now,
    });
    const sec = out.find((s) => s.title.includes("Security"))!;
    expect(sec.source).toBe("lever");
    expect(sec.summary).toContain("SOC Analyst II");
  });
});

describe("GDELT", () => {
  it("parses seendate and classifies type", () => {
    expect(parseGdeltDate("20261102T121500Z")?.toISOString()).toBe("2026-11-02T12:15:00.000Z");
    expect(parseGdeltDate("bad")).toBeNull();
    const out = gdeltAdapter.normalize(JSON.parse(fx("gdelt.json")), { account, now });
    expect(out.map((s) => s.type)).toEqual(["expansion", "incident"]);
  });
});

describe("classification & dedupe", () => {
  it("classifies signal types from text", () => {
    expect(classifySignalType("Acme to acquire Widget Co")).toBe("m-and-a");
    expect(classifySignalType("Acme names new Chief Information Officer")).toBe("exec-change");
    expect(classifySignalType("Acme hit by ransomware attack")).toBe("incident");
    expect(classifySignalType("Acme Q3 results beat estimates")).toBe("earnings");
    expect(classifySignalType("Acme opens new data center in Ohio")).toBe("expansion");
    expect(classifySignalType("Acme sponsors charity run")).toBe("news");
  });
  it("detects technologies in job titles", () => {
    expect(
      detectTech("Senior Kubernetes Platform Engineer (AWS)").map((t) => t.technology),
    ).toEqual(["Kubernetes", "AWS"]);
  });
  it("normalizes URLs and hashes per account", () => {
    expect(normalizeUrl("https://WWW.Example.com/a/?utm_source=x&b=2&a=1#frag")).toBe(
      "https://example.com/a?a=1&b=2",
    );
    const a = dedupeHash("acc", "https://example.com/a?utm_medium=x", "Big News!");
    expect(dedupeHash("acc", "https://www.example.com/a", "big news")).toBe(a);
    expect(dedupeHash("other", "https://example.com/a", "big news")).not.toBe(a);
    expect(dedupeHash("acc", null, "x", "k1")).not.toBe(dedupeHash("acc", null, "x", "k2"));
  });
});

describe("http client", () => {
  const memDb = () => {
    const store = new Map<
      string,
      { key: string; body: string; etag: string | null; fetchedAt: Date }
    >();
    return {
      store,
      httpCache: {
        findUnique: async ({ where: { key } }: { where: { key: string } }) =>
          store.get(key) ?? null,
        upsert: async ({
          create,
        }: {
          create: { key: string; body: string; etag: string | null; fetchedAt: Date };
        }) => store.set(create.key, create),
        update: async ({
          where: { key },
          data,
        }: {
          where: { key: string };
          data: { fetchedAt: Date };
        }) => store.set(key, { ...store.get(key)!, ...data }),
      },
    };
  };
  it("retries 429 with backoff, then caches", async () => {
    __resetRateLimiter();
    const db = memDb();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValueOnce(new Response("ok-body", { status: 200, headers: { etag: "v1" } }));
    const sleep = vi.fn(async () => {});
    const r = await fetchText("https://api.example.com/x", {
      db: db as never,
      ttlMs: 60_000,
      fetchImpl,
      sleep,
      minIntervalMs: 0,
    });
    expect(r).toEqual({ body: "ok-body", cached: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
    const again = await fetchText("https://api.example.com/x", {
      db: db as never,
      ttlMs: 60_000,
      fetchImpl,
      sleep,
      minIntervalMs: 0,
    });
    expect(again.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("does not retry 404 and surfaces the error", async () => {
    __resetRateLimiter();
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    await expect(
      fetchText("https://api.example.com/missing", {
        db: memDb() as never,
        ttlMs: 0,
        fetchImpl,
        sleep: async () => {},
        minIntervalMs: 0,
      }),
    ).rejects.toThrow(/404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("backoff grows exponentially and respects Retry-After", () => {
    expect(backoffDelay(0, 1000, 7)).toBe(7000);
    expect(backoffDelay(3, 1000)).toBeGreaterThanOrEqual(8000);
    expect(backoffDelay(10, 1000)).toBeLessThanOrEqual(30_250);
  });
});

describe("private placeholder", () => {
  it("private-future adapter throws a clear not-configured error", async () => {
    await expect(crmPlaceholderAdapter.fetch({} as never)).rejects.toThrow(
      /requires company approval/,
    );
  });
});
