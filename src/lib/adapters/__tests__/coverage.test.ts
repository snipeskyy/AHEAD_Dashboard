import { describe, expect, it } from "vitest";
import { SIGNAL_ADAPTERS } from "..";
import { computeCoverage, runnableCount } from "../coverage";
import type { AdapterAccount } from "../types";

const acct = (o: Partial<AdapterAccount> = {}): AdapterAccount => ({
  id: "a",
  name: "Example Co",
  domain: "example.com",
  ticker: null,
  cik: null,
  isDemo: false,
  tier: "Growth",
  sourceConfig: {},
  ...o,
});
const env = { secUserAgent: false, publicFetch: true };

describe("source coverage", () => {
  it("explains why a freshly imported account fetches nothing", () => {
    const c = computeCoverage({
      adapters: SIGNAL_ADAPTERS,
      accounts: [acct({ ticker: "EXMP" })],
      enabled: {},
      env,
    });
    expect(runnableCount(c)).toBe(0);
    const news = c.find((s) => s.id === "google-news")!;
    expect(news).toMatchObject({ eligible: 0, total: 1, action: "enable-google-news" });
    expect(c.find((s) => s.id === "sec-edgar")!.hint).toMatch(
      /SEC_USER_AGENT.*1 accounts have tickers/,
    );
  });
  it("counts accounts once a source is switched on", () => {
    const c = computeCoverage({
      adapters: SIGNAL_ADAPTERS,
      accounts: [acct({ sourceConfig: { googleNews: true } }), acct({ id: "b", ticker: "EXMP" })],
      enabled: {},
      env: { ...env, secUserAgent: true },
    });
    expect(c.find((s) => s.id === "google-news")).toMatchObject({ eligible: 1, hint: null });
    expect(c.find((s) => s.id === "sec-edgar")).toMatchObject({ eligible: 1, hint: null });
    expect(runnableCount(c)).toBeGreaterThanOrEqual(2);
  });
  it("reports the global kill switch", () => {
    const c = computeCoverage({
      adapters: SIGNAL_ADAPTERS,
      accounts: [acct()],
      enabled: {},
      env: { ...env, publicFetch: false },
    });
    expect(runnableCount(c)).toBe(0);
    expect(c[0].hint).toMatch(/PUBLIC_FETCH_ENABLED/);
  });
});
