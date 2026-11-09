import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { createSqliteSearchProvider } from "../../src/lib/search/sqlite-provider";
import { wipeAllTables } from "../../tests/fixtures/seed/wipe";

/**
 * Phase 9: every page on ZERO records — designed empty states, no errors, no serious axe violations,
 * screenshots in light and dark (screenshots/<theme>/empty-*.png). TEST database only.
 */
const testDbUrl = `file:${path.join(process.cwd(), "prisma", (process.env.DATABASE_URL_TEST ?? "file:./test.db").replace(/^file:\.?\/?/, ""))}`;

test.describe.configure({ mode: "default" }); // one worker: beforeAll wipes once; a failure doesn't skip the rest

test.beforeAll(async () => {
  const db = new PrismaClient({ datasourceUrl: testDbUrl });
  await wipeAllTables(db);
  await createSqliteSearchProvider(db).ensureReady();
  await db.$disconnect();
});

async function shoot(page: Page, name: string) {
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => {
      localStorage.setItem("theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `screenshots/${theme}/empty-${name}.png`, fullPage: true });
  }
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
  });
}

const PAGES: Array<[string, string, RegExp | string]> = [
  ["my-day", "/", "Welcome to Account Command Center"],
  ["dashboard", "/dashboard", /Import your accounts|No opportunities yet|Portfolio overview/],
  ["tasks", "/tasks", /No open tasks|Nothing/],
  ["territory", "/territory", /Import your accounts|No accounts/],
  ["fix-it", "/fix-it", /Import your accounts|Nothing to fix|No accounts/],
  ["partners", "/partners", "No partners yet"],
  ["smart-lists", "/lists", "New list"],
  ["triage", "/signals?tab=triage", /Inbox zero|No signals yet/],
  ["share", "/share", "Download pack"],
  ["share-import", "/share?tab=import", "Choose pack file"],
  ["audit-log", "/share?tab=audit", /Nothing recorded yet|Audit entries/],
  ["settings-profile", "/settings?tab=profile", "Your profile"],
  ["settings-data", "/settings?tab=data", "Backups & restore"],
  ["settings-contract", "/settings?tab=contract", "Local read-only API"],
  ["team", "/team", "No open tasks"],
  ["team-plan", "/team?tab=plan", "No plans yet"],
  ["team-digest", "/team?tab=digest", "No deals closed this week."],
  ["business-cases", "/cases", "No business cases yet"],
  ["sandbox", "/sandbox", "No scenarios yet"],
];

for (const [name, url, text] of PAGES) {
  test(`empty: ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(url);
    await expect(page.getByText(text).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")} — ${v.help}`)).toEqual([]);
    await shoot(page, name);
    expect(errors).toEqual([]);
  });
}
