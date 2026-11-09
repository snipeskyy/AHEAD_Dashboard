import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Phase 11: TCO / business-case builder (user-entered assumptions only). */

async function fill(page: Page, line: string, label: string, value: string) {
  const row = page.getByRole("listitem", { name: `Cost line: ${line}` });
  await row.getByLabel(label, { exact: true }).fill(value);
}

test("build a TCO from a structure, see savings/payback, save a version, export it", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.goto("/cases?account=demo-acc-008");
  await page.getByLabel("Name").fill("E2E refresh vs cloud");
  await page.getByLabel("Start from").selectOption("refresh-vs-cloud");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/cases\/.+/);
  await expect(page.getByText("Enter costs on the left")).toBeVisible(); // structure only: everything starts at $0

  await page.getByLabel("Period (years)").selectOption("3");
  await fill(page, "Server & storage refresh", "Amount ($)", "600000");
  await fill(page, "Hardware support", "Per year ($)", "100000");
  await fill(page, "IT power & cooling", "IT load (kW)", "100");
  await fill(page, "IT power & cooling", "Energy price", "0.12");
  await expect(page.getByRole("listitem", { name: "Cost line: IT power & cooling" })).toContainText(
    "100 kW IT × 70% × 8,760 h × PUE 1.5 × $0.12/kWh",
  );

  await page.getByRole("tab", { name: "Migrate to public cloud" }).click();
  await fill(page, "Migration services", "Amount ($)", "150000");
  await fill(page, "Compute (reserved + on-demand)", "Per year ($)", "180000");

  // Refresh: 600k + 3×100k + 3×(100×0.7×8760×1.5×0.12 = 110,376) = 1,231,128; cloud: 150k + 540k = 690k.
  const box = page.getByRole("region", { name: "Business case" });
  await expect(box).toContainText("$541K");
  await expect(
    page
      .getByRole("region", { name: "Version comparison" })
      .or(page.getByText("Save a version"))
      .first(),
  ).toBeVisible();
  await expect(box.getByText("Payback")).toBeVisible();
  await expect(page.getByRole("img", { name: /Sensitivity/ })).toBeVisible();

  await page.getByLabel("Version label").fill("First pass");
  await page.getByRole("button", { name: /Save v1/ }).click();
  await expect(page.getByLabel("Version to compare")).toContainText("v1 · First pass");
  // The version captured what was on screen (pending autosave flushed first).
  await expect(
    page
      .getByRole("region", { name: "Version comparison" })
      .getByRole("row", { name: /Total savings/ }),
  ).toContainText("$541,128 $541,128".split(" ")[1]);
  await expect(
    page
      .getByRole("region", { name: "Version comparison" })
      .getByRole("row", { name: /Total savings/ })
      .getByRole("cell")
      .nth(2),
  ).toHaveText("$541,128");
  await page.getByRole("radio", { name: "Final" }).click();

  // Toasts fade in/out (partial opacity reads as low contrast); they're transient, so leave them out of the scan.
  const r = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id}: ${v.nodes[0]?.target.join(" ")} ${v.nodes[0]?.failureSummary?.slice(0, 160)}`,
      ),
  ).toEqual([]);
  await page.screenshot({ path: "screenshots/light/business-case.png", fullPage: true });

  // Export: the section carries the headline and every assumption.
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/business-cases?accountId=demo-acc-008")).json()).items[0]
          ?.status,
    )
    .toBe("final");
  const doc = await (
    await request.post("/api/exports/preview", {
      data: {
        config: {
          title: "TCO",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["business-cases.tco"],
          audience: "customer",
        },
      },
    })
  ).json();
  const text = JSON.stringify(doc.sections[0]);
  expect(text).toContain("E2E refresh vs cloud");
  expect(text).toContain("Assumptions");
  expect(text).toContain("Estimate based on the assumptions listed");
  const pptx = await (
    await request.post("/api/exports", {
      data: {
        format: "pptx",
        config: {
          title: "TCO deck",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["exports.cover", "business-cases.tco"],
          audience: "customer",
          style: "deck",
        },
      },
    })
  ).json();
  expect(pptx.job.status).toBe("done");
});

test("business cases list is accessible", async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "TCO & business cases" })).toBeVisible();
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id}: ${v.nodes[0]?.target.join(" ")} ${v.nodes[0]?.failureSummary?.slice(0, 160)}`,
      ),
  ).toEqual([]);
});
