import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Labels of fields marked `internal` that must never reach a customer-facing export. */
const INTERNAL_TERMS = [
  "Prob.",
  "Competitors",
  "Risk flags",
  "Relevance",
  "Confidence",
  "Health score",
  "Whitespace score",
  "Buying committee",
  "Internal notes",
];

test.describe("Phase 4: exports", () => {
  test("builder shows redaction preview and generates a customer-facing PDF without internal fields", async ({
    page,
    request,
  }) => {
    await page.goto("/exports?account=demo-acc-008");
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
    const preview = page.getByLabel("Export preview");
    await expect(preview.getByText("Account overview")).toBeVisible({ timeout: 60_000 });

    await page.getByRole("radio", { name: "Customer-facing" }).click();
    await expect(page.getByText(/\d+ items? redacted/)).toBeVisible({ timeout: 60_000 });
    await expect(preview.getByText("Internal-only section — removed").first()).toBeVisible();

    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/exports") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "PDF" }).click();
    const res = await created;
    expect(res.status()).toBe(201);
    const { job, removedFields } = (await res.json()) as {
      job: { id: string; status: string };
      removedFields: string[];
    };
    expect(job.status).toBe("done");
    expect(removedFields.length).toBeGreaterThan(0);

    // The downloaded file is a real PDF…
    const dl = await request.get(`/api/exports/${job.id}/download`);
    expect(dl.ok()).toBeTruthy();
    expect((await dl.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // …printed from this exact snapshot, which must contain none of the internal fields.
    await page.goto(`/print/export/${job.id}`);
    const doc = page.locator("[data-print-ready]");
    await expect(doc).toContainText("Account overview");
    const text = (await doc.innerText()).toLowerCase();
    for (const term of INTERNAL_TERMS)
      expect(text, `"${term}" leaked into a customer export`).not.toContain(term.toLowerCase());
    expect(text).not.toContain("hidden in this export");

    // History lists it with re-run.
    await page.goto("/exports");
    await page.getByRole("tab", { name: "History" }).click();
    await expect(
      page.getByRole("button", { name: /Re-run .+ with fresh data/ }).first(),
    ).toBeVisible();
  });

  test("markdown internal export keeps internal fields", async ({ request }) => {
    const r = await request.post("/api/exports", {
      data: {
        format: "markdown",
        config: {
          title: "E2E internal",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["opportunities.pipeline"],
          audience: "internal",
        },
      },
    });
    expect(r.status()).toBe(201);
    const { job } = (await r.json()) as { job: { id: string } };
    const md = await (await request.get(`/api/exports/${job.id}/download`)).text();
    expect(md).toContain("Prob.");
    expect(md).toContain("Competitors");
  });
});

test.describe("Phase 4: sandbox & presentation", () => {
  test("sandbox landing shows the illustrative rack preview", async ({ page }) => {
    await page.goto("/sandbox");
    await expect(page.getByRole("img", { name: /R01 · AI training/ })).toBeVisible();
    await expect(page.getByText("Illustrative, not vendor-certified").first()).toBeVisible();
  });

  test("presentation mode hides internal-only UI and can be exited", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Portfolio overview" })).toBeVisible({
      timeout: 60_000,
    });
    // Retry until hydrated: the toggle is server-rendered before its click handler is attached.
    await expect(async () => {
      await page.getByRole("button", { name: "Presentation Mode" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-presentation", "true", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByText("Internal-only — hidden while presenting").first()).toBeVisible();
    await page.getByRole("button", { name: "Exit" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-presentation", "true");
  });
});

test.describe("Phase 4: accessibility (axe, WCAG 2 AA)", () => {
  for (const path of [
    "/",
    "/dashboard",
    "/tasks",
    "/territory",
    "/fix-it",
    "/partners",
    "/lists",
    "/signals?tab=triage",
    "/accounts/demo-acc-008/brief",
    "/accounts",
    "/accounts/demo-acc-008",
    "/accounts/demo-acc-008?tab=profile",
    "/signals",
    "/opportunities",
    "/opportunities?view=table",
    "/demand-gen",
    "/exports",
    "/sandbox",
    "/settings",
    "/import",
    "/import?tab=history",
  ]) {
    test(`no serious violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.locator("main h1").first().waitFor();
      await page.waitForTimeout(1500);
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .exclude(".echarts-for-react")
        .analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        bad.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")} — ${v.help}`),
      ).toEqual([]);
    });
  }
});
