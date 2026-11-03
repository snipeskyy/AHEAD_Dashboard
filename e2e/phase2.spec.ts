import path from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

async function json<T>(req: APIRequestContext, url: string): Promise<T> {
  const r = await req.get(url);
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as T;
}

test.describe("Phase 2: Command Home", () => {
  test("loads KPI strip and the default layout widgets", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Weighted pipeline")).toBeVisible();
    await expect(page.getByRole("region", { name: "Forecast vs target" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Next best actions" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Forecast versus target by period" })).toBeVisible();
  });

  test("customize: add a widget, save as a new layout, persists after reload", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Customize" }).click();
    await expect(page.getByTestId("widget-grid")).toHaveAttribute("data-editing", "true");
    await page.getByRole("button", { name: "Add widget" }).click();
    await page.getByRole("button", { name: "Add Account health heatmap" }).click();
    await page.getByRole("button", { name: "Save as…" }).click();
    await page.getByLabel("New layout name").fill("E2E Layout");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Choose layout" })).toContainText("E2E Layout");
    await page.reload();
    await expect(page.getByRole("button", { name: "Choose layout" })).toContainText("E2E Layout");
    await expect(page.getByRole("region", { name: "Account health heatmap" })).toBeVisible();
    // cleanup
    const { items } = await json<{ items: Array<{ id: string; name: string }> }>(
      request,
      "/api/layouts",
    );
    for (const l of items.filter((x) => x.name.startsWith("E2E Layout")))
      await request.delete(`/api/layouts/${l.id}`);
  });

  test("switches between saved layouts", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Choose layout" }).click();
    await page.getByRole("menuitem", { name: /Account Prep/ }).click();
    await expect(page.getByRole("region", { name: "Signal feed" })).toBeVisible();
    await page.getByRole("button", { name: "Choose layout" }).click();
    await page.getByRole("menuitem", { name: /Monday Pipeline Review/ }).click();
    await expect(page.getByRole("region", { name: "Stalled deals" })).toBeVisible();
  });
});

test.describe("Phase 2: Account 360", () => {
  test("opens an account from the list and navigates every tab", async ({ page }) => {
    await page.goto("/accounts");
    const firstRow = page
      .getByRole("region", { name: "Accounts table" })
      .locator("tbody tr[data-index]")
      .first();
    const name = (
      await firstRow.locator("td").first().locator("div > div").first().innerText()
    ).trim();
    await firstRow.click();
    await expect(page).toHaveURL(/\/accounts\/[\w-]+/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Health score" })).toBeVisible();
    for (const [tab, marker] of [
      ["Intelligence", "Opening angles"],
      ["Buying Committee", "Coverage gaps"],
      ["Whitespace", "Whitespace map"],
      ["Signals", "Type:"],
      ["Opportunities", "New opportunity"],
      ["Activity", ""],
      ["Account Plan", "Account plan"],
    ] as const) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page).toHaveURL(new RegExp(`tab=`));
      if (marker) await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    }
  });
});

test.describe("Phase 2: Opportunities", () => {
  test("drag an opportunity from Qualify to Discover records stage history", async ({
    page,
    request,
  }) => {
    await page.goto("/opportunities?view=board");
    const card = page
      .getByTestId("kanban-col-Qualify")
      .locator('[data-testid^="opp-card-"]')
      .first();
    const oppId = (await card.getAttribute("data-testid"))!.replace("opp-card-", "");
    const target = page.getByTestId("kanban-col-Discover");
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
    await page.mouse.up();
    await expect(target.getByTestId(`opp-card-${oppId}`)).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await json<{ stage: string; stageHistory: Array<{ toStage: string }> }>(
              request,
              `/api/opportunities/${oppId}`,
            )
          ).stage,
      )
      .toBe("Discover");
    const detail = await json<{
      stageHistory: Array<{ fromStage: string | null; toStage: string }>;
    }>(request, `/api/opportunities/${oppId}`);
    expect(detail.stageHistory.at(-1)).toMatchObject({ fromStage: "Qualify", toStage: "Discover" });
    // restore
    await request.patch(`/api/opportunities/${oppId}`, { data: { stage: "Qualify" } });
  });

  test("table view inline-edits next step and forecast view renders", async ({ page, request }) => {
    await page.goto("/opportunities?view=table");
    const input = page
      .getByRole("region", { name: "Opportunities table" })
      .getByLabel(/^Next step for /)
      .first();
    const label = (await input.getAttribute("aria-label"))!;
    const original = await input.inputValue();
    await input.fill("E2E next step");
    await input.press("Enter");
    await expect(page.getByLabel(label)).toHaveValue("E2E next step");
    await page.getByRole("tab", { name: "Forecast" }).click();
    await expect(page.getByRole("heading", { name: "Forecast vs target" })).toBeVisible();
    // restore via API
    const { items } = await json<{ items: Array<{ id: string; name: string }> }>(
      request,
      "/api/opportunities?status=open",
    );
    const opp = items.find((o) => label.endsWith(o.name))!;
    await request.patch(`/api/opportunities/${opp.id}`, { data: { nextStep: original || null } });
  });

  test("opens the detail sheet with MEDDPICC", async ({ page }) => {
    await page.goto("/opportunities?focus=demo-opp-0005");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "MEDDPICC" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Economic Buyer status" })).toBeVisible();
  });
});

test.describe("Phase 2: CSV import of real public accounts", () => {
  test("imports examples/target-accounts.csv with no generated intelligence", async ({
    page,
    request,
  }) => {
    await page.goto("/accounts/import");
    await page
      .getByTestId("csv-input")
      .setInputFiles(path.join(process.cwd(), "examples", "target-accounts.csv"));
    await expect(page.getByLabel(/Company name/)).toHaveValue("Company");
    await expect(page.getByText("2 of 2 rows ready")).toBeVisible();
    await page.getByRole("button", { name: "Import 2 accounts" }).click();
    await expect(page.getByText("Import complete")).toBeVisible();
    await page.getByRole("link", { name: "Caterpillar Inc." }).click();
    await expect(page.getByText("Real account · public sources only")).toBeVisible();
    await page.getByRole("tab", { name: "Intelligence" }).click();
    await expect(page.getByText(/This is a real account/).first()).toBeVisible();
    // cleanup
    const { items } = await json<{ items: Array<{ id: string; name: string; isDemo: boolean }> }>(
      request,
      "/api/accounts",
    );
    for (const a of items.filter(
      (x) => !x.isDemo && ["Caterpillar Inc.", "Humana Inc."].includes(x.name),
    ))
      await request.delete(`/api/accounts/${a.id}`);
  });
});
