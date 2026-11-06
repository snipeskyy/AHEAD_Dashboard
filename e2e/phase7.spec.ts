import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/** Phase 7: daily-use features. Each test covers one feature's main flow on the test DB. */

const ACC = "demo-acc-008";

async function account(req: APIRequestContext) {
  const r = await req.get(`/api/accounts/${ACC}/brief`);
  expect(r.ok()).toBeTruthy();
  return ((await r.json()) as { account: { id: string; name: string; domain: string | null } })
    .account;
}

async function pickAccount(
  page: Page,
  scope: ReturnType<Page["getByRole"]>,
  label: string,
  name: string,
) {
  await scope.getByLabel(label, { exact: true }).fill(name.split(" ")[0]);
  await page
    .getByRole("listbox", { name: "Matching accounts" })
    .getByRole("option", { name: new RegExp(name) })
    .first()
    .click();
}

/** Wait until client handlers are attached (keyboard shortcuts live in a client effect). */
async function hydrated(page: Page) {
  await page.locator("main h1").first().waitFor();
  await page.waitForLoadState("networkidle");
}

test.describe("Phase 7: daily use", () => {
  test("My Day is the landing page and every item suggests a next action", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible();
    for (const r of [
      "Meetings (today & tomorrow)",
      "Top signals",
      "Tasks due",
      "Deals needing attention",
      "Accounts past their cadence",
      "Budget timing",
    ])
      await expect(page.getByRole("region", { name: r })).toBeVisible();
    const deals = page.getByRole("region", { name: "Deals needing attention" });
    await expect(deals.getByRole("listitem").first()).toBeVisible();
    await expect(deals.getByRole("listitem").first().locator(".text-primary")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Command Home" }),
    ).toBeVisible();
  });

  test("? opens the shortcut overlay listing triage keys", async ({ page }) => {
    await page.goto("/");
    await hydrated(page);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+?");
    const dlg = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dlg).toBeVisible();
    await expect(
      dlg
        .getByText("G O")
        .or(dlg.getByText(/Go to Opportunities/))
        .first(),
    ).toBeVisible();
    await expect(dlg.getByText(/dismiss/i).first()).toBeVisible();
  });

  test("t quick-adds a task; completing a recurring task schedules the next one", async ({
    page,
    request,
  }) => {
    await page.goto("/tasks");
    await hydrated(page);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("t");
    const dlg = page.getByRole("dialog", { name: "New task" });
    await expect(dlg).toBeVisible();
    await dlg.getByLabel("Task", { exact: true }).fill("E2E weekly pipeline review");
    await dlg.getByLabel("Due").fill(new Date().toISOString().slice(0, 10));
    await dlg.getByLabel("Repeats").selectOption("weekly");
    await dlg.getByRole("button", { name: "Add task" }).click();
    await expect(dlg).toBeHidden();
    await page.getByRole("checkbox", { name: "Complete: E2E weekly pipeline review" }).click();
    await expect
      .poll(async () => {
        const r = await request.get("/api/tasks?status=open");
        const { items } = (await r.json()) as {
          items: Array<{ title: string; dueDate: string | null }>;
        };
        return items.filter((t) => t.title === "E2E weekly pipeline review").length;
      })
      .toBe(1);
  });

  test("quick capture saves a tagged note and turns Action lines into tasks", async ({
    page,
    request,
  }) => {
    const acc = await account(request);
    await page.goto("/");
    await hydrated(page);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("c");
    const dlg = page.getByRole("dialog", { name: "Quick capture" });
    await expect(dlg).toBeVisible();
    await dlg
      .getByLabel("Notes")
      .fill(
        "Met the infra team #gpu\nAction: send E2E capacity brief by Friday\nTODO: E2E intro to security lead",
      );
    await pickAccount(page, dlg, "Account", acc.name);
    await expect(
      dlg.getByRole("checkbox", { name: /Create task: send E2E capacity brief/ }),
    ).toBeChecked();
    await dlg.getByRole("button", { name: "Save note & 2 tasks" }).click();
    await expect(dlg).toBeHidden();
    const r = await request.get(`/api/tasks?status=open&accountId=${acc.id}`);
    const { items } = (await r.json()) as { items: Array<{ title: string }> };
    expect(items.map((t) => t.title).join("|")).toMatch(/E2E capacity brief/);
  });

  test("keyboard triage: j/k move, s stars, d dismisses, counter goes down", async ({ page }) => {
    await page.goto("/signals?tab=triage");
    const counter = page.getByRole("region", { name: "Triage queue" }).getByRole("status");
    await expect(counter).toContainText("to triage");
    await hydrated(page);
    const before = Number((await counter.innerText()).match(/\d+/)![0]);
    expect(before).toBeGreaterThan(2);
    await page.getByRole("listbox", { name: "Signals to triage" }).focus();
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("s");
    await expect(counter).toContainText(`${before - 1} to triage`);
    await page.keyboard.press("d");
    await expect(counter).toContainText(`${before - 2} to triage`);
    await page.reload();
    const week = page.getByRole("complementary", { name: "Triaged this week" });
    await expect(week.getByText("starred")).toBeVisible();
    await expect(week.getByText("dismissed")).toBeVisible();
  });

  test("import an .ics calendar, then open the meeting prep brief and export it", async ({
    page,
    request,
  }) => {
    const acc = await account(request);
    expect(acc.domain).toBeTruthy();
    const start = new Date(Date.now() + 2 * 3600_000);
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//E2E//EN",
      "BEGIN:VEVENT",
      "UID:e2e-meeting-1",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(new Date(start.getTime() + 3600_000))}`,
      "SUMMARY:E2E quarterly review",
      `ATTENDEE;CN=Someone:mailto:someone@${acc.domain}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    await page.goto("/");
    await page
      .getByLabel("Calendar file (.ics)")
      .setInputFiles({ name: "cal.ics", mimeType: "text/calendar", buffer: Buffer.from(ics) });
    await expect(page.getByText(/Imported 1 meeting/)).toBeVisible();
    const meetings = page.getByRole("region", { name: "Meetings (today & tomorrow)" });
    await expect(meetings.getByText("E2E quarterly review")).toBeVisible();
    // Only the domain is stored, never the address or name.
    const stored = await (await request.get("/api/meetings?days=2")).text();
    expect(stored).not.toContain("someone@");
    expect(stored).not.toContain("Someone");
    await meetings.getByRole("link", { name: "Prep brief" }).first().click();
    await expect(page).toHaveURL(/\/brief$/);
    for (const s of ["Snapshot", "Suggested questions", "Open opportunities", "Buying committee"])
      await expect(page.getByRole("region", { name: s })).toBeVisible();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-presentation", "true");
    await page.getByRole("button", { name: "Exit presentation" }).click();
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/exports") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Markdown" }).click();
    const { job } = (await (await created).json()) as { job: { id: string } };
    const md = await (await request.get(`/api/exports/${job.id}/download`)).text();
    expect(md).toContain("Suggested questions");
    expect(md).toContain("INTERNAL ONLY");
    await request.delete("/api/meetings");
  });

  test("territory shows neglected/momentum lists; fix-it queue fills a field", async ({ page }) => {
    await page.goto("/territory");
    await expect(page.getByRole("heading", { name: "Neglected accounts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most momentum" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget timing" })).toBeVisible();
    await page.goto("/fix-it");
    await expect(page.getByRole("heading", { name: "Fix-it queue" })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Fix-it queue" })
        .or(page.getByText("Nothing to fix"))
        .first(),
    ).toBeVisible();
  });

  test("partners: add a rep, log a joint touch, add a registration", async ({ page, request }) => {
    const acc = await account(request);
    await page.goto("/partners");
    await page.getByRole("button", { name: "Add rep" }).first().click();
    let dlg = page.getByRole("dialog", { name: "Add partner rep" });
    await dlg.getByLabel("Partner company").fill("E2E Compute OEM");
    await dlg.getByLabel("Rep name").fill("Rep Example");
    await pickAccount(page, dlg, "Accounts they cover", acc.name);
    await dlg.getByRole("button", { name: "Add rep" }).click();
    await expect(dlg).toBeHidden();
    const card = page
      .getByRole("region", { name: "E2E Compute OEM" })
      .or(page.locator("section", { hasText: "E2E Compute OEM" }))
      .first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Log joint touch" }).first().click();
    dlg = page.getByRole("dialog", { name: /Log a joint touch with Rep Example/ });
    await expect(dlg).toContainText(acc.name); // defaults to the rep's first covered account
    await dlg.getByLabel("With (persona)").fill("VP Infrastructure");
    await dlg.getByRole("button", { name: "Log touch" }).click();
    await expect(dlg).toBeHidden();
    await expect(card).not.toContainText("last joint touch never");
    await card.getByRole("button", { name: "Registration" }).click();
    dlg = page.getByRole("dialog", { name: /New deal registration/ });
    await pickAccount(page, dlg, "Account", acc.name);
    await dlg.getByRole("button", { name: "Add registration" }).click();
    await expect(dlg).toBeHidden();
    await expect(card).toContainText("1 open registrations");
  });

  test("smart list: build with the query builder, save, pinned in sidebar", async ({ page }) => {
    await page.goto("/lists");
    await expect(page.getByRole("status").filter({ hasText: /match/ })).toBeVisible();
    await page.getByLabel("Name").fill("E2E strategic AI gap");
    await page.getByRole("button", { name: "Save list" }).click();
    await expect(page).toHaveURL(/\/lists\/.+/);
    await expect(page.getByRole("heading", { name: "E2E strategic AI gap" })).toBeVisible();
    const pinned = page.getByRole("group", { name: "Pinned lists" });
    await expect(pinned.getByRole("link", { name: "E2E strategic AI gap" })).toBeVisible();
    await page.getByRole("button", { name: "Delete list" }).click();
    await expect(page).toHaveURL(/\/lists$/);
  });

  test("opportunities without a dated next step are flagged", async ({ page, request }) => {
    const r = await request.get("/api/opportunities");
    const { items } = (await r.json()) as {
      items: Array<{ id: string; stage: string; riskFlags: string[] }>;
    };
    const flagged = items.find((o) => o.riskFlags.includes("no-next-step"));
    expect(flagged).toBeTruthy();
    await page.goto(`/opportunities?focus=${flagged!.id}`);
    await expect(page.getByRole("dialog").getByText("Needs a dated next step")).toBeVisible();
  });
});
