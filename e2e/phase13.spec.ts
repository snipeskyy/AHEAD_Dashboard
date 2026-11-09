import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** Phase 13: data contract import (preview → import → undo as one group) and the token-protected local API. */
test("import the example contract file with preview, export it, and undo the whole file", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.goto("/settings?tab=contract");
  await expect(page.getByRole("heading", { name: "Data contract", exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
  ).toEqual([]);

  const schema = await request.get("/api/contract/schema");
  expect(schema.ok()).toBe(true);
  expect((await schema.json()).$schema).toContain("2020-12");

  const file = readFileSync("docs/contract/example.acc-data.json");
  await page
    .getByLabel("Contract file")
    .setInputFiles({ name: "example.acc-data.json", mimeType: "application/json", buffer: file });
  const preview = page.getByRole("region", { name: "Import preview" });
  await expect(preview).toContainText("Accounts");
  await expect(preview).toContainText("Partner reps");
  await page.getByRole("button", { name: /^Import \d+ changes?$/ }).click();
  await expect(page.getByText("Data contract imported")).toBeVisible();

  const exp = await (await request.get("/api/contract/export?visibility=customer-safe")).json();
  const acc = exp.entities.accounts.find(
    (a: { name: string }) => a.name === "Example Holdings Inc.",
  );
  expect(acc.externalRefs).toEqual({ "example-system": "A-1001" });
  expect(exp.entities.notes).toEqual([]);
  expect(exp.entities.opportunities.every((o: object) => !("amount" in o))).toBe(true);

  await page.goto("/import?tab=history");
  const row = page
    .getByRole("row")
    .filter({ hasText: "Data contract · example.acc-data.json" })
    .first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /^Undo import/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /undo/i }).last().click();
  await expect(page.getByText("Import undone")).toBeVisible();
  const after = await (await request.get("/api/contract/export")).json();
  expect(
    after.entities.accounts.some((a: { name: string }) => a.name === "Example Holdings Inc."),
  ).toBe(false);
});

test("local API is off by default, then needs the token", async ({ page, request }) => {
  expect((await request.get("/api/v1/accounts")).status()).toBe(403);
  expect((await request.get("/api/settings/api.local")).status()).toBe(404);
  await page.goto("/settings?tab=contract");
  await page.getByLabel("Enable the local API").click();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  expect((await request.get("/api/v1/accounts")).status()).toBe(401);
  await page.getByRole("button", { name: "Generate token" }).click();
  const token = (await page.getByTestId("api-token").textContent())!.trim();
  expect(token).toMatch(/^acc_/);
  const ok = await request.get("/api/v1/accounts", {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).format).toBe("acc-data");
  expect(
    (
      await request.post("/api/v1/accounts", { headers: { authorization: `Bearer ${token}` } })
    ).status(),
  ).toBe(405);
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("No token yet")).toBeVisible();
  expect(
    (
      await request.get("/api/v1/accounts", { headers: { authorization: `Bearer ${token}` } })
    ).status(),
  ).toBe(401);
  await page.getByLabel("Enable the local API").click();
  await expect(page.getByText("Off", { exact: true })).toBeVisible();
});
