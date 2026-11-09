import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

/** Phase 12: the full DC Sandbox (illustrative planning model). */

async function scenarioId(request: APIRequestContext, name: string) {
  const { items } = (await (await request.get("/api/sandbox")).json()) as {
    items: Array<{ id: string; name: string }>;
  };
  return items.find((s) => s.name === name)!.id;
}

test("build a room, edit racks with undo, check capacity, ops, 3D and the tour", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.goto("/sandbox?account=demo-acc-008");
  await page.getByLabel("Name").fill("E2E AI pod");
  await page.getByLabel("Start from").selectOption("ai-pod");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/sandbox\/.+/);
  await expect(page.getByRole("group", { name: /Floor plan/ })).toBeVisible();
  await expect(page.getByText("0 critical issues")).toBeVisible();

  // Add an air-cooled rack and overload it with air-cooled GPU servers → a critical issue appears.
  await page.getByRole("button", { name: "Add rack" }).click();
  const panel = page.getByRole("complementary", { name: "Selection" });
  await panel.getByLabel("Device to add").selectOption("gpu-8x-air");
  for (let i = 0; i < 3; i++) await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.getByLabel("Rack issues")).toContainText("air-cooling ceiling");
  await expect(page.getByText(/[1-9] critical issues?/)).toBeVisible();
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await page.getByRole("button", { name: "Undo (Ctrl+Z)" }).click();
  await expect(panel.getByText(/air-cooling ceiling/)).toHaveCount(0);

  // Keyboard: move the selected rack one tile right.
  const rack = page.getByRole("button", { name: /^R05: / });
  await rack.focus();
  const id = await scenarioId(request, "E2E AI pod");
  const r05 = async () =>
    (await (await request.get(`/api/sandbox/${id}`)).json()).spec.racks.find(
      (r: { label: string }) => r.label === "R05",
    ) as { x: number } | undefined;
  await expect.poll(r05).toBeTruthy(); // autosave lands ~0.7 s after the last edit
  const before = (await r05())!;
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/sandbox/${id}`)).json()).spec.racks.find(
          (r: { label: string }) => r.label === "R05",
        )?.x,
    )
    .toBe(before.x + 1);
  await page.screenshot({ path: "screenshots/light/sandbox-floor.png", fullPage: true });

  await page.getByRole("tab", { name: "Capacity & what-ifs" }).click();
  await expect(page.getByText("PUE (estimate)").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Growth runway" })).toContainText("At 30%/yr");
  await expect(page.getByRole("region", { name: "Cooling unit failures" })).toContainText("CDU-1");
  const axe = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
  ).toEqual([]);

  await page.getByRole("tab", { name: "Operations (simulated)" }).click();
  await expect(page.getByText(/Simulated telemetry for illustration/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Rack telemetry" })).toContainText("AI-1");

  await page.getByRole("tab", { name: "3D view" }).click();
  const three = page.getByRole("img", { name: /3D view of/ });
  await expect(three).toBeVisible();
  await expect(three.locator("canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Walk the aisle" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/light/sandbox-3d.png" });

  await page.getByRole("button", { name: "Customer tour" }).click();
  await expect(page.getByRole("dialog", { name: /Tour step 1 of 5/ })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("dialog", { name: /Tour step 2 of 5: Walk the aisle/ }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: /Capacity at a glance/ })).toContainText(
    "estimated PUE",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Tour step/ })).toBeHidden();
});

test("what-if copy compares before/after; a business case starts from the scenario; exports include the views", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const id = await scenarioId(request, "E2E AI pod");
  await page.goto(`/sandbox/${id}`);
  await page.getByRole("button", { name: "What-if copy" }).click();
  await expect(page).toHaveURL(
    (u) => u.pathname.startsWith("/sandbox/") && !u.pathname.endsWith(id),
  );
  await page.getByRole("tab", { name: "Before / after" }).click();
  await expect(page.getByRole("region", { name: "Before and after comparison" })).toContainText(
    "E2E AI pod",
  );

  await page.getByRole("button", { name: "Business case" }).click();
  await expect(page).toHaveURL(/\/cases\/.+/);
  await expect(page.getByText(/kW IT × 100% × 8,760 h × PUE 1\.\d+/).first()).toBeVisible();

  const doc = await (
    await request.post("/api/exports/preview", {
      data: {
        config: {
          title: "Sandbox",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["sandbox.views", "sandbox.capacity"],
          audience: "customer",
        },
      },
    })
  ).json();
  const text = JSON.stringify(doc.sections);
  expect(text).toContain("<svg");
  expect(text).toContain("PUE (estimate)");
  expect(text).toContain("not vendor-certified");
  const deck = await (
    await request.post("/api/exports", {
      data: {
        format: "pptx",
        config: {
          title: "Sandbox deck",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["exports.cover", "sandbox.views", "sandbox.capacity"],
          audience: "customer",
          style: "deck",
        },
      },
    })
  ).json();
  expect(deck.job.status).toBe("done");
});
