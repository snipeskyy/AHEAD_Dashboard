import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext } from "@playwright/test";

/** Phase 8: team-ready foundations. Runs on the test DB (fixtures are demo rows, so packs use a real test account). */

async function realAccount(request: APIRequestContext, name: string, domain: string) {
  const r = await request.post("/api/import/commit", {
    data: {
      kind: "accounts",
      inputType: "paste",
      decisions: {},
      rows: [{ name, domain, tier: "Strategic" }],
    },
  });
  expect(r.ok()).toBeTruthy();
  const { batchId } = (await r.json()) as { batchId: string };
  return batchId;
}

async function setRole(request: APIRequestContext, role: string) {
  expect((await request.patch("/api/me", { data: { role } })).ok()).toBeTruthy();
}

test.describe("Phase 8: team foundations", () => {
  test("records carry ownership metadata and deletes are audited", async ({ page, request }) => {
    const t = await (await request.post("/api/tasks", { data: { title: "E2E audit me" } })).json();
    const id = (t.task ?? t).id as string;
    await request.delete(`/api/tasks/${id}`);
    await page.goto("/share?tab=audit");
    await page.getByLabel("Show").selectOption("delete");
    await expect(
      page.getByRole("region", { name: "Audit entries" }).getByText(/Deleted task “E2E audit me”/),
    ).toBeVisible();
  });

  test("profile role hides deal amounts on screen and locks them in exports", async ({
    page,
    request,
  }) => {
    await page.goto("/settings?tab=profile");
    await page.getByLabel("Role", { exact: true }).selectOption("inside-sales");
    await expect(page.getByText("Hidden: Deal amounts & pipeline $")).toBeVisible();
    try {
      await page.goto("/opportunities?view=table");
      await expect(page.getByRole("link", { name: /Viewing as Inside Sales/ })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-role-hide", /opp\.amount/);
      await expect(page.locator('[data-field="opp.amount"]').first()).toBeHidden();
      await page.goto("/opportunities?view=forecast");
      await expect(page.getByText("Pipeline dollar views are hidden for your role")).toBeVisible();
    } finally {
      await setRole(request, "associate-client-director");
    }
  });

  test("comments with @mentions on an account", async ({ page, request }) => {
    await request.post("/api/users", {
      data: { displayName: "Riley Teammate", role: "solutions-architect" },
    });
    await page.goto("/accounts/demo-acc-008");
    const thread = page.getByRole("region", { name: "Comments" });
    const box = thread.getByLabel("New comment");
    await box.fill("Can @Ril");
    await page
      .getByRole("listbox", { name: "Mention a teammate" })
      .getByRole("option", { name: "Riley Teammate" })
      .click();
    await box.pressSequentially("take the architecture review?");
    await thread.getByRole("button", { name: "Comment" }).click();
    await expect(
      thread
        .locator("li")
        .filter({ hasText: "take the architecture review?" })
        .locator(".text-primary", { hasText: "@Riley Teammate" }),
    ).toBeVisible();
  });

  test("share a pack, import it back (merge), and undo the import", async ({ page, request }) => {
    const created = await realAccount(request, "Packwell Example Corp", "packwell.example");
    await page.goto("/share");
    await page.getByPlaceholder("Add an account…").fill("Packwell");
    await page
      .getByRole("listbox", { name: "Matching accounts" })
      .getByRole("option", { name: /Packwell/ })
      .first()
      .click();
    await page.getByLabel("Comments").check();
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download pack" }).click();
    const file = await (await dl).path();
    const pack = JSON.parse(readFileSync(file!, "utf8"));
    expect(pack).toMatchObject({
      format: "acc-pack",
      version: 1,
      accounts: [{ identity: { name: "Packwell Example Corp" } }],
    });

    await page.goto("/share?tab=import");
    await page.getByLabel("Pack file (.json)").setInputFiles({
      name: "pack.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(pack)),
    });
    const preview = page.getByRole("region", { name: "Pack preview" });
    await expect(preview.getByText(/Matches/)).toBeVisible();
    await expect(preview.getByLabel("Action for Packwell Example Corp")).toHaveValue("merge");
    await preview.getByRole("button", { name: "Import pack" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Imported: 0 new account\(s\), 1 merged/ }),
    ).toBeVisible();

    const { items } = (await (await request.get("/api/import/batches")).json()) as {
      items: Array<{ id: string; kind: string }>;
    };
    const packBatch = items.find((b) => b.kind === "pack")!;
    expect(packBatch).toBeTruthy();
    expect((await request.post(`/api/import/batches/${packBatch.id}/undo`)).ok()).toBeTruthy();
    await request.post(`/api/import/batches/${created}/undo`);
    await page.goto("/share?tab=audit");
    await expect(page.getByText(/Exported pack “Packwell Example Corp”/)).toBeVisible();
  });

  test("Play Library exports and previews as identical on re-import", async ({ page }) => {
    await page.goto("/share?tab=plays");
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download plays" }).click();
    const file = await (await dl).path();
    const pack = readFileSync(file!, "utf8");
    expect(JSON.parse(pack).format).toBe("acc-plays");
    await page.getByLabel("Play library file (.json)").setInputFiles({
      name: "plays.json",
      mimeType: "application/json",
      buffer: Buffer.from(pack),
    });
    await expect(
      page.getByRole("status").filter({ hasText: /0 new, 0 different from yours/ }),
    ).toBeVisible();
  });
});
