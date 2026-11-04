import path from "node:path";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { createSqliteSearchProvider } from "../../src/lib/search/sqlite-provider";
import { wipeAllTables } from "../../tests/fixtures/seed/wipe";

/**
 * Phase 5: the app on ZERO records. Runs after the fixture project; wipes the TEST database
 * (never the real one: same file the e2e server uses via scripts/with-test-db.mjs).
 */
const testDbUrl = `file:${path.join(process.cwd(), "prisma", (process.env.DATABASE_URL_TEST ?? "file:./test.db").replace(/^file:\.?\/?/, ""))}`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = new PrismaClient({ datasourceUrl: testDbUrl });
  await wipeAllTables(db);
  await createSqliteSearchProvider(db).ensureReady();
  await db.$disconnect();
});

const shoot = async (page: Page, name: string) => {
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((t) => {
      localStorage.setItem("theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${theme}/empty-${name}.png`, fullPage: true });
  }
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
  });
};

test("empty workspace: onboarding, empty states, blank targets, no errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to Account Command Center" }),
  ).toBeVisible();
  const steps = page.getByRole("list", { name: "Getting started" });
  for (const s of [
    "Import your accounts",
    "Resolve identities",
    "Enrich from public sources",
    "Review and fill the gaps",
  ])
    await expect(steps.getByText(s)).toBeVisible();
  await shoot(page, "home");

  for (const [url, text, name] of [
    ["/accounts", "No accounts yet", "accounts"],
    ["/opportunities", "No opportunities yet", "opportunities"],
    ["/signals", "No signals yet", "signals"],
    ["/demand-gen?tab=recommender", "Import your accounts first", "recommender"],
    ["/demand-gen?tab=events", "No upcoming events", "events"],
    ["/exports", "Import your accounts first", "exports"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByText(text).first()).toBeVisible();
    await shoot(page, name);
  }
  // Starter Plays are installed on first use and labeled.
  await page.goto("/demand-gen?tab=plays");
  await expect(page.getByText("Starter").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("import accounts by paste, then opportunities by CSV; duplicates are detected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Import accounts" }).first().click();
  await expect(page).toHaveURL(/\/import\?kind=accounts/);
  await page.getByRole("radio", { name: "Paste" }).click();
  await page
    .getByLabel(/One company per line/)
    .fill("Example Holdings Inc., example.com\nSample Logistics\nSample Logistics Co\nX");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Column for Company name")).toHaveValue("Company");
  await expect(page.getByLabel("Column for Domain / website")).toHaveValue("Domain");
  await expect(page.getByText("1 row with errors (will be skipped)")).toBeVisible();
  await shoot(page, "import-mapping");
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText("repeated in this file")).toBeVisible(); // Sample Logistics Co
  await shoot(page, "import-review");
  await page.getByRole("button", { name: "Import: create 2" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fetch for 2 accounts" })).toBeVisible();

  await page.goto("/accounts");
  await expect(page.getByText("2 of 2 accounts")).toBeVisible();

  // Opportunities via CSV upload (headers = template labels → auto-mapped).
  await page.goto("/import?kind=opportunities");
  await page.getByLabel("Choose a CSV or Excel file").setInputFiles({
    name: "opps.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Account (name or domain),Opportunity name,Practice area,Stage,Amount (USD),Close date\n" +
        "example.com,GPU pilot,AI Infrastructure,Discover,$250k,12/15/2026\n" +
        "Nobody Corp,Ghost deal,Cloud,Qualify,1000,2026-12-01\n",
    ),
  });
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText(/No account matches "Nobody Corp"/)).toBeVisible();
  await page.getByRole("button", { name: "Import: create 1" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();
  await page.goto("/opportunities?view=table");
  await expect(page.getByText("GPU pilot")).toBeVisible();
});

test("XLSX re-import proposes a merge; undo restores the previous values", async ({ page }) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Accounts");
  ws.addRow(["Company", "Website", "Industry", "Tier"]);
  ws.addRow(["EXAMPLE HOLDINGS", "https://www.example.com", "Insurance", "Strategic"]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  await page.goto("/import?kind=accounts");
  await page.getByLabel("Choose a CSV or Excel file").setInputFiles({
    name: "accounts.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByLabel("Column for Industry")).toHaveValue("Industry");
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText("(same domain)")).toBeVisible();
  await expect(page.getByLabel("Decision for row 1")).toHaveValue("merge");
  await page.getByRole("button", { name: "Import: create 0, merge 1" }).click();
  await expect(page.getByText("Import complete")).toBeVisible();

  await page.goto("/accounts");
  await expect(page.getByText("Insurance")).toBeVisible();

  await page.goto("/import?tab=history");
  await expect(
    page.getByRole("region", { name: "Import history" }).getByText("accounts.xlsx"),
  ).toBeVisible();
  await shoot(page, "import-history");
  await page
    .getByRole("button", { name: /^Undo import from/ })
    .first()
    .click();
  await expect(page.getByText(/restores 1 merged record/)).toBeVisible();
  await page.getByRole("button", { name: "Undo import" }).click();
  await expect(page.getByText(/^Undone/).first()).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText("Insurance")).toHaveCount(0);
});

test("templates download for every import type", async ({ request }) => {
  for (const kind of ["accounts", "contacts", "opportunities", "notes", "partner-reps"]) {
    const csv = await request.get(`/api/import/template?kind=${kind}&format=csv`);
    expect(csv.ok()).toBe(true);
    expect((await csv.text()).split("\n")[0].length).toBeGreaterThan(5);
    const xlsx = await request.get(`/api/import/template?kind=${kind}&format=xlsx`);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  }
});
