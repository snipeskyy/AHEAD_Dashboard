import { test, expect, type Page } from "@playwright/test";

/** Screenshot pass of every main page in light and dark mode → ./screenshots (git-ignored). */
const PAGES = [
  { name: "home", path: "/" },
  { name: "accounts", path: "/accounts" },
  { name: "account-360", path: "/accounts/demo-acc-008" },
  { name: "account-360-intelligence", path: "/accounts/demo-acc-008?tab=intelligence" },
  { name: "account-360-committee", path: "/accounts/demo-acc-008?tab=committee" },
  { name: "account-360-whitespace", path: "/accounts/demo-acc-008?tab=whitespace" },
  { name: "account-360-plan", path: "/accounts/demo-acc-021?tab=plan" },
  { name: "import", path: "/import" },
  { name: "import-history", path: "/import?tab=history" },
  { name: "signals", path: "/signals" },
  { name: "signals-digest", path: "/signals?tab=digest" },
  { name: "signal-detail", path: "/signals?focus=demo-sig-00010" },
  { name: "opportunities", path: "/opportunities" },
  { name: "opportunities-table", path: "/opportunities?view=table" },
  { name: "opportunities-forecast", path: "/opportunities?view=forecast" },
  { name: "opportunities-analytics", path: "/opportunities?view=analytics" },
  { name: "opportunity-detail", path: "/opportunities?focus=demo-opp-0005" },
  { name: "demand-gen", path: "/demand-gen" },
  { name: "demand-gen-recommender", path: "/demand-gen?tab=recommender&account=demo-acc-008" },
  { name: "demand-gen-campaigns", path: "/demand-gen?tab=campaigns" },
  { name: "demand-gen-messages", path: "/demand-gen?tab=messages&account=demo-acc-008" },
  { name: "demand-gen-events", path: "/demand-gen?tab=events" },
  { name: "demand-gen-metrics", path: "/demand-gen?tab=metrics" },
  { name: "exports", path: "/exports" },
  { name: "exports-account", path: "/exports?account=demo-acc-008" },
  { name: "sandbox", path: "/sandbox" },
  { name: "settings", path: "/settings" },
  { name: "settings-modules", path: "/settings?tab=modules" },
  { name: "settings-sources", path: "/settings?tab=sources" },
  { name: "settings-scoring", path: "/settings?tab=scoring" },
  { name: "settings-taxonomy", path: "/settings?tab=taxonomy" },
];

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => setTheme(page, theme));
    for (const p of PAGES) {
      test(`${p.name}`, async ({ page }) => {
        await page.goto(p.path);
        await expect(page.locator("main h1").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400); // let charts finish their entry animation
        await page.screenshot({ path: `screenshots/${theme}/${p.name}.png`, fullPage: true });
      });
    }
  });
}

test("mobile shell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("status", { name: "Connected to the test database" })).toBeVisible();
  await page.screenshot({ path: "screenshots/light/mobile-home.png" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600); // let the sheet finish sliding in
  await page.screenshot({ path: "screenshots/light/mobile-nav.png" });
});

test("command palette", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/Jump to an account/).fill("gpu");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.screenshot({ path: "screenshots/light/command-palette.png" });
});
