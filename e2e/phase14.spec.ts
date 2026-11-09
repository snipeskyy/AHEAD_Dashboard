import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Phase 14: win/loss analytics, mutual action plans (PDF + export), team workspace + digest, shortcuts. */
async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    r.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`),
  ).toEqual([]);
}

test("win / loss view shows trends, a computed takeaway and recorded close reasons", async ({
  page,
}) => {
  await page.goto("/opportunities?view=win-loss");
  await expect(page.getByRole("heading", { name: "Won and lost by quarter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage conversion by cohort" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why deals closed" })).toBeVisible();
  await expect(page.getByText(/Win rate (rose|fell|held)/)).toBeVisible();
  await axe(page);
});

test("mutual action plan: edit, customer view hides internal steps, PDF, export section", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const opps = (await (await request.get("/api/opportunities")).json()).items as Array<{
    id: string;
    accountId: string;
    stage: string;
    name: string;
  }>;
  const opp = opps.find((o) => o.accountId === "demo-acc-008" && !o.stage.startsWith("Closed"))!;
  // The fixture already has plans for the two largest; use a fresh one if possible.
  let plan = (await (await request.get(`/api/opportunities/${opp.id}/plan`)).json()).plan;
  if (plan) await request.delete(`/api/opportunities/${opp.id}/plan`);

  await page.goto(`/opportunities/${opp.id}/plan`);
  await page.getByRole("button", { name: "Start from the standard path" }).click();
  await expect(page.getByRole("region", { name: "Plan steps" })).toBeVisible();
  await page
    .getByLabel("Customer objective (shown to the customer)")
    .fill("E2E objective: decide by quarter end");
  await page.getByLabel("Status, step 1").selectOption("done");
  await page.getByLabel("Customer sees step 3").uncheck();
  await page.getByLabel("Internal note, step 2").fill("E2E secret note");
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  await axe(page);

  await page.getByRole("tab", { name: "Customer view" }).click();
  const view = page.getByRole("article", { name: "Mutual action plan" });
  await expect(view).toContainText("E2E objective");
  await expect(view).toContainText("Discovery workshop");
  await expect(view).not.toContainText("Technical validation");
  await expect(view).not.toContainText("E2E secret note");

  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/opportunities/${opp.id}/plan`)).json()).plan.steps[0]
          .status,
    )
    .toBe("done");
  plan = (await (await request.get(`/api/opportunities/${opp.id}/plan`)).json()).plan;
  expect(plan.objective).toContain("E2E objective");

  const pdf = await request.get(`/api/opportunities/${opp.id}/plan/pdf?audience=customer`);
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const doc = await (
    await request.post("/api/exports/preview", {
      data: {
        config: {
          title: "MAP",
          scope: { type: "account", accountIds: ["demo-acc-008"] },
          sections: ["opportunities.action-plan"],
          audience: "customer",
        },
        mode: "apply",
      },
    })
  ).json();
  const text = JSON.stringify(doc.sections[0]);
  expect(text).toContain("Discovery workshop");
  expect(text).not.toContain("E2E secret note");
  expect(text).not.toContain("Internal steps (not shown to the customer)");
});

test("team workspace: assign a task to a teammate, see the territory plan and download the digest", async ({
  page,
  request,
}) => {
  const mate = (
    await (
      await request.post("/api/users", {
        data: { displayName: "Riley Sample", role: "solutions-architect" },
      })
    ).json()
  ).user;
  await request.post("/api/tasks", {
    data: {
      title: "E2E team task",
      accountId: "demo-acc-008",
      dueDate: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  });

  await page.goto("/team");
  const mine = page.getByRole("region", { name: "Tasks for Me" });
  await expect(mine).toContainText("E2E team task");
  await mine.getByLabel("Assignee for E2E team task").selectOption(mate.id);
  await expect(page.getByText("Task reassigned")).toBeVisible();
  await expect(page.getByRole("region", { name: "Tasks for Riley Sample" })).toContainText(
    "E2E team task",
  );
  await expect(page.getByRole("region", { name: "Tasks for Riley Sample" })).toContainText(
    "1 overdue",
  );
  await axe(page);

  await page.getByRole("tab", { name: "Territory plan" }).click();
  await expect(page.getByRole("region", { name: "Plan health" })).toContainText("path to decision");
  await axe(page);

  await page.getByRole("tab", { name: "Weekly digest" }).click();
  const digest = page.getByRole("article", { name: "Weekly team digest" });
  await expect(digest).toContainText("weekly digest");
  await expect(digest).toContainText("Riley Sample: 1 overdue");
  await axe(page);
  const md = await request.get("/api/team-workspace/digest?format=md");
  expect(md.headers()["content-type"]).toContain("text/markdown");
  expect(await md.text()).toMatch(/^# .+ weekly digest/);
});

test("new screens have keyboard shortcuts listed in the ? overlay", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("g");
  await page.keyboard.press("w");
  await expect(page).toHaveURL(/\/team/);
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/cases/);
  await page.keyboard.press("g");
  await page.keyboard.press("x");
  await expect(page).toHaveURL(/\/sandbox/);
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  for (const label of ["Go to Team workspace", "TCO & business cases", "Go to DC Sandbox"])
    await expect(help).toContainText(label);
});
