import { expect, test, type APIRequestContext } from "@playwright/test";

async function json<T>(req: APIRequestContext, url: string): Promise<T> {
  const r = await req.get(url);
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as T;
}

test.describe("Phase 3: Live Signals", () => {
  test("feed loads, filters by practice and shows the relevance breakdown", async ({ page }) => {
    await page.goto("/signals");
    await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
      timeout: 15_000,
    });
    const feed = page.getByRole("feed", { name: "Signal feed" });
    await expect(feed.locator("article").first()).toBeVisible();
    await page.getByRole("button", { name: /^Practice:/ }).click();
    await page.getByRole("option", { name: "Security" }).click();
    await page.keyboard.press("Escape");
    await expect(feed.locator("article").first()).toContainText("Security");
    await feed
      .getByRole("button", { name: /^Relevance \d+\. Show breakdown/ })
      .first()
      .hover();
    await expect(page.getByRole("tooltip")).toContainText("Practice match");
  });

  test("a new signal streams in over SSE", async ({ page, request }) => {
    await page.goto("/signals");
    await expect(page.getByRole("status").filter({ hasText: "Live" })).toBeVisible({
      timeout: 15_000,
    });
    const title = `E2E live signal ${Date.now()} GPU cluster`;
    const r = await request.post("/api/signals", {
      data: { accountId: "demo-acc-008", url: `https://example.com/e2e/${Date.now()}`, title },
    });
    expect(r.status()).toBe(201);
    await page.getByRole("button", { name: /new signal/ }).click({ timeout: 15_000 });
    await expect(page.getByRole("feed").getByText(title)).toBeVisible();
  });

  test("convert a signal to a play launches a campaign with linked touches", async ({
    page,
    request,
  }) => {
    const title = `E2E convert ${Date.now()}: hiring GPU engineers for AI cluster`;
    const created = await (
      await request.post("/api/signals", {
        data: {
          accountId: "demo-acc-021",
          url: `https://example.com/e2e-convert/${Date.now()}`,
          title,
        },
      })
    ).json();
    await page.goto(`/signals?focus=${created.id}`);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(title)).toBeVisible();
    await expect(sheet.getByText("Practice tagging")).toBeVisible();
    await sheet.getByRole("button", { name: "Play", exact: true }).click();
    const dlg = page.getByRole("dialog", { name: "Convert to play" });
    await expect(dlg.getByRole("radio").first()).toBeVisible();
    await dlg.getByRole("button", { name: "Launch play" }).click();
    await expect(page.getByText(/Play launched with \d+ planned touches/)).toBeVisible();
    const touches = await json<{
      items: Array<{ sourceSignalId: string | null; completedAt: string | null }>;
    }>(request, "/api/touches?accountId=demo-acc-021&limit=500");
    expect(touches.items.filter((t) => t.sourceSignalId === created.id).length).toBeGreaterThan(0);
  });

  test("manual signal entry via the dialog", async ({ page }) => {
    await page.goto("/signals");
    await page.getByRole("button", { name: "Add signal" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Account").fill("Prescott");
    await page
      .getByRole("listbox", { name: "Matching accounts" })
      .getByRole("option")
      .first()
      .click();
    await dlg.getByLabel("Public URL").fill(`https://example.com/manual/${Date.now()}`);
    await dlg.getByLabel("Headline").fill("Prescott Vale opens a new data center campus");
    await dlg.getByRole("button", { name: "Add signal" }).click();
    await expect(page.getByText("Signal added")).toBeVisible();
  });

  test("digest view summarizes the day", async ({ page }) => {
    await page.goto("/signals?tab=digest");
    await expect(page.getByRole("heading", { name: "Most important" })).toBeVisible();
    await page.getByRole("radio", { name: "Weekly" }).click();
    await expect(page.getByText("last 7 days")).toBeVisible();
  });
});

test.describe("Phase 3: Demand Gen", () => {
  test("recommender explains plays and launches one", async ({ page }) => {
    await page.goto("/demand-gen?tab=recommender&account=demo-acc-008");
    const first = page.locator("ol > li").first();
    await expect(
      first.getByRole("list", { name: "Why this play" }).getByRole("listitem").first(),
    ).toBeVisible();
    await first.getByRole("button", { name: "Launch" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Launch play" }).click();
    await expect(page.getByText(/Campaign created with \d+ planned touches/)).toBeVisible();
  });

  test("message builder renders a draft from account context", async ({ page }) => {
    await page.goto("/demand-gen?tab=messages&account=demo-acc-008");
    const body = page.getByLabel("Draft (editable)");
    await expect(body).toContainText("Prescott Vale Regional Health");
    await page.getByLabel("First name (optional, typed by you)").fill("Sam");
    await expect(body).toContainText("Hi Sam,");
    await page.getByRole("radio", { name: "LinkedIn" }).click();
    await expect(page.getByText(/characters \/ 300/)).toBeVisible();
  });

  test("campaign planner: drag a planned touch to another day", async ({ page, request }) => {
    await page.goto("/demand-gen?tab=campaigns");
    const chip = page
      .locator('[data-testid^="touch-"]:not([disabled])')
      .filter({ has: page.locator("svg") })
      .first();
    await expect(chip).toBeVisible();
    // pick a planned (draggable) chip: aria-label contains "planned"
    const planned = page.getByRole("button", { name: /, planned$/ }).first();
    const id = (await planned.getAttribute("data-testid"))!.replace("touch-", "");
    const before = (
      await json<{ items: Array<{ id: string; scheduledAt: string }> }>(
        request,
        "/api/touches?limit=2000&upcoming=true",
      )
    ).items.find((t) => t.id === id)!;
    const box = (await planned.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2 + 190, box.y + box.height / 2 + 40, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            await json<{ items: Array<{ id: string; scheduledAt: string }> }>(
              request,
              "/api/touches?limit=2000&upcoming=true",
            )
          ).items.find((t) => t.id === id)?.scheduledAt,
      )
      .not.toBe(before.scheduledAt);
  });

  test("events: create an event and invite an account", async ({ page, request }) => {
    await page.goto("/demand-gen?tab=events");
    await page.getByRole("button", { name: "New event" }).click();
    const name = `E2E Roundtable ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByPlaceholder("Search accounts…").fill("Prescott");
    await page
      .getByRole("listbox", { name: "Matching accounts" })
      .getByRole("option")
      .first()
      .click();
    await sheet.getByRole("button", { name: "Invite" }).click();
    await expect(sheet.getByRole("combobox", { name: /Invite status for/ })).toBeVisible();
    const ev = (
      await json<{ items: Array<{ id: string; name: string }> }>(request, "/api/events")
    ).items.find((e) => e.name === name)!;
    await request.delete(`/api/events/${ev.id}`);
  });
});

test.describe("Phase 3: Settings", () => {
  test("tagging rules can be edited and tested live", async ({ page }) => {
    await page.goto("/settings?tab=taxonomy");
    await page.getByLabel("Sample headline").fill("Acme adopts quantum annealing");
    await expect(page.getByText("No practice area matched.")).toBeVisible();
    await page.getByLabel("Add keyword to AI Infrastructure").fill("quantum annealing");
    await page.getByLabel("Add keyword to AI Infrastructure").press("Enter");
    await expect(page.getByText("“quantum annealing” → AI Infra")).toBeVisible();
    // not saved: leave rules unchanged
  });

  test("data sources show scheduler and per-source fetch", async ({ page }) => {
    await page.goto("/settings?tab=sources");
    await expect(page.getByLabel("Fetch interval")).toBeVisible();
    await expect(page.getByRole("button", { name: "Fetch Google News RSS now" })).toBeVisible();
  });
});
