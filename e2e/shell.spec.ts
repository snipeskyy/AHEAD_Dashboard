import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("lands on My Day with the test-DB chip and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Deals needing attention" })).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Connected to the test database" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("command palette jumps to an account via full-text search", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByPlaceholder(/Jump to an account/).fill("regional health");
    await page.getByRole("group", { name: "Accounts" }).getByRole("option").first().click();
    await expect(page).toHaveURL(/\/accounts\/demo-acc-\d+/);
  });

  test("command palette runs navigation commands", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByPlaceholder(/Jump to an account/);
    await input.fill("Command Home");
    await expect(page.getByRole("option", { name: /Go to Command Home/ })).toBeVisible();
    await input.fill("Settings");
    await page.getByRole("option", { name: /Open Settings/ }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("g-sequence keyboard shortcut navigates", async ({ page }) => {
    await page.goto("/");
    await page.locator("main").click();
    await page.keyboard.press("g");
    await page.keyboard.press("o");
    await expect(page).toHaveURL(/\/opportunities/);
  });

  test("presentation mode hides internal-only tiles and persists", async ({ page }) => {
    await page.goto("/dashboard");
    const internal = page.locator('[data-internal-only="true"]').first();
    await expect(internal).toBeVisible();
    await page.getByRole("button", { name: "Presentation Mode" }).click();
    await expect(internal).toBeHidden();
    await page.reload();
    await expect(page.locator('[data-internal-only="true"]').first()).toBeHidden();
    await page.getByRole("button", { name: "Presentation Mode" }).click();
    await expect(page.locator('[data-internal-only="true"]').first()).toBeVisible();
  });

  test("feature flag hides a module from nav and routing", async ({ page, request }) => {
    await request.put("/api/settings/featureFlags", {
      data: { value: { "module.sandbox": false } },
    });
    try {
      await page.goto("/");
      await expect(page.getByRole("link", { name: "Opportunities" }).first()).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /DC Sandbox/ }),
      ).toHaveCount(0);
      const res = await page.goto("/sandbox");
      expect(res?.status()).toBe(404);
    } finally {
      await request.put("/api/settings/featureFlags", { data: { value: {} } });
    }
  });

  test("notification center opens and lists signals", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Notifications/ }).click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
  });
});
