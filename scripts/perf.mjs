#!/usr/bin/env node
/**
 * `npm run perf`: Phase 9 performance pass against a running server on the TEST database
 * (seed it with `npm run test:db:seed:perf` first: 500 accounts, 2,000 opps, 50,000 signals).
 * Measures API latency (median / p95 of N runs, payload size) and page load time to first heading
 * plus network idle. Writes perf-report.json. Never touches the real database.
 *
 *   PERF_BASE=http://localhost:3100 PERF_RUNS=7 npm run perf
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.PERF_BASE ?? "http://localhost:3100";
const RUNS = Number(process.env.PERF_RUNS ?? 7);

const APIS = [
  "/api/meta",
  "/api/accounts",
  "/api/opportunities",
  "/api/signals?limit=50",
  "/api/my-day",
  "/api/territory",
  "/api/fix-it",
  "/api/enrichment/overview",
  "/api/tasks?status=open",
  "/api/partners",
  "/api/pipeline",
  "/api/dashboard/next-actions",
  "/api/dashboard/health-matrix",
  "/api/search?q=gpu",
  "/api/audit?limit=50",
];
const PAGES = ["/", "/dashboard", "/accounts", "/accounts/demo-acc-008", "/opportunities", "/opportunities?view=table", "/opportunities?view=analytics", "/signals", "/signals?tab=triage", "/territory", "/tasks", "/lists", "/share"];

const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const ms = (n) => Math.round(n);

async function api(path) {
  const times = [];
  let size = 0;
  let status = 0;
  for (let i = 0; i < RUNS + 1; i++) {
    const t = performance.now();
    const res = await fetch(BASE + path);
    const body = await res.arrayBuffer();
    if (i > 0) times.push(performance.now() - t); // first call warms caches / compiles
    size = body.byteLength;
    status = res.status;
  }
  return { path, status, medianMs: ms(q(times, 0.5)), p95Ms: ms(q(times, 0.95)), kb: Math.round(size / 1024) };
}

async function pages() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = [];
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: "networkidle" }); // warm
    const times = [];
    for (let i = 0; i < Math.min(RUNS, 3); i++) {
      const t = performance.now();
      await page.goto(BASE + p);
      await page.locator("main h1").first().waitFor();
      const firstHeading = performance.now() - t;
      await page.waitForLoadState("networkidle");
      times.push({ firstHeading, idle: performance.now() - t });
    }
    out.push({ path: p, headingMs: ms(q(times.map((x) => x.firstHeading), 0.5)), idleMs: ms(q(times.map((x) => x.idle), 0.5)) });
  }
  await browser.close();
  return out;
}

const meta = await (await fetch(BASE + "/api/meta")).json().catch(() => ({}));
const apiResults = [];
for (const p of APIS) apiResults.push(await api(p));
const pageResults = await pages();
const report = { base: BASE, runs: RUNS, at: new Date().toISOString(), counts: meta.counts ?? null, api: apiResults, pages: pageResults };
writeFileSync("perf-report.json", JSON.stringify(report, null, 2));
console.table(apiResults);
console.table(pageResults);
console.log("Wrote perf-report.json");
