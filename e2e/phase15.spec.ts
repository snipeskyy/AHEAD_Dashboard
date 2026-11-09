import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** Phase 15: bringing in Glean output safely (review queue, provenance, remove-by-source) and hardening. */
const GLEAN = () => {
  const c = JSON.parse(readFileSync("docs/contract/example.acc-data.json", "utf8"));
  c.source = { system: "glean" };
  c.entities.accounts[0].name = "Gleanfield Example Corp";
  c.entities.accounts[0].domain = "gleanfield.example";
  return c;
};

test("paste Glean output (fenced), review field changes, apply, then remove everything from glean", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await page.goto("/settings?tab=contract");
  await expect(page.getByRole("list", { name: "Security checklist" })).toContainText(
    "Encrypted backups",
  );
  const pasted =
    "Here is the data you asked for:\n```json\n" + JSON.stringify(GLEAN(), null, 2) + "\n```";
  await page.getByLabel("Paste Glean output").fill(pasted);
  await page.getByRole("button", { name: "Review pasted data" }).click();
  const review = page.getByRole("region", { name: "Review changes" });
  await expect(review).toContainText("From glean");
  await review.getByText("Accounts").click();
  await expect(review).toContainText("Gleanfield Example Corp");
  const axe = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
  ).toEqual([]);
  await review.getByRole("button", { name: /^Apply \d+ changes?$/ }).click();
  await expect(page.getByText("Data applied")).toBeVisible();
  const exp = await (await request.get("/api/contract/export")).json();
  expect(
    exp.entities.accounts.find((a: { name: string }) => a.name === "Gleanfield Example Corp")
      ?.externalRefs,
  ).toEqual({ glean: "A-1001" });

  const sources = page.getByRole("list", { name: "Data by source" });
  await expect(sources).toContainText("glean");
  await sources.getByRole("button", { name: "Remove all data from glean" }).click();
  const dlg = page.getByRole("dialog", { name: "Remove all data from glean?" });
  await expect(dlg.getByRole("button", { name: "Remove" })).toBeDisabled();
  await dlg.getByLabel("Type REMOVE glean to confirm").fill("REMOVE glean");
  await dlg.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Removed data from glean")).toBeVisible();
  const after = await (await request.get("/api/contract/export")).json();
  expect(
    after.entities.accounts.some((a: { name: string }) => a.name === "Gleanfield Example Corp"),
  ).toBe(false);
});

test("staging API: off by default; with staging on and a token, a file waits for review; cross-site writes refused", async ({
  page,
  request,
}) => {
  const body = JSON.stringify(GLEAN());
  expect(
    (
      await request.post("/api/v1/staged-imports", {
        data: body,
        headers: { "content-type": "application/json" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/settings?tab=contract");
  await page.getByLabel("Enable the local API").click();
  await page.getByLabel("Let tools with the token send data for review").click();
  await page.getByRole("button", { name: /Generate token|Replace token/ }).click();
  const token = (await page.getByTestId("api-token").textContent())!.trim();
  const r = await request.post("/api/v1/staged-imports", {
    data: body,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-acc-file-name": "glean-action.json",
    },
  });
  expect(r.status()).toBe(202);
  expect((await r.json()).status).toBe("pending-review");
  await page.reload();
  const queue = page.getByRole("list", { name: "Waiting for review" });
  await expect(queue).toContainText("glean-action.json");
  await queue.getByRole("button", { name: "Review glean-action.json" }).click();
  await page
    .getByRole("region", { name: "Review changes" })
    .getByRole("button", { name: "Discard" })
    .click();
  await expect(page.getByText("Discarded; nothing was changed")).toBeVisible();

  // CSRF: a write from another site is refused even without a token check on that route.
  const evil = await request.post("/api/tasks", {
    data: { title: "Cross-site task" },
    headers: { origin: "https://evil.example" },
  });
  expect(evil.status()).toBe(403);
  await page.getByLabel("Let tools with the token send data for review").click();
  await page.getByLabel("Enable the local API").click();
  await page.getByRole("button", { name: "Revoke" }).click();
});
