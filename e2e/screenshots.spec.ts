import { test, expect, type Page } from "@playwright/test";

/** Screenshot pass of every main page in light and dark mode → ./screenshots (git-ignored). */
const PAGES = [
  { name: "home", path: "/" },
  { name: "accounts", path: "/accounts" },
  { name: "account-360", path: "/accounts/demo-acc-001" },
  { name: "signals", path: "/signals" },
  { name: "opportunities", path: "/opportunities" },
  { name: "demand-gen", path: "/demand-gen" },
  { name: "exports", path: "/exports" },
  { name: "sandbox", path: "/sandbox" },
  { name: "settings", path: "/settings" },
  { name: "settings-modules", path: "/settings?tab=modules" },
  { name: "settings-sources", path: "/settings?tab=sources" },
  { name: "settings-scoring", path: "/settings?tab=scoring" },
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
  await expect(page.getByRole("status").filter({ hasText: "Demo" })).toBeVisible();
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
