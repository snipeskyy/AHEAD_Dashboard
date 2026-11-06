import { expect, test } from "@playwright/test";

/** Phase 9: backups & restore round trip through the UI (test DB; files land in the git-ignored backups/). */
test("back up now, change data, restore with typed confirmation, data is back", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.goto("/settings?tab=data");
  const section = page.getByRole("region", { name: "Backups" });
  await expect(page.getByText("Backups & restore")).toBeVisible();
  await expect(
    page.getByLabel("Automatic daily backup (runs in the background worker)"),
  ).toBeChecked();
  await expect(page.getByLabel("Keep the last")).toHaveValue("14");

  await page.getByRole("button", { name: "Back up now" }).click();
  await expect(page.getByText("Backup written")).toBeVisible();
  const { items } = (await (await request.get("/api/backups")).json()) as {
    items: Array<{ file: string; kind: string }>;
  };
  const mine = items.find((b) => b.kind === "manual")!;
  expect(mine).toBeTruthy();

  // Something created after the backup must disappear on restore.
  await request.post("/api/tasks", { data: { title: "E2E restore canary" } });
  expect(JSON.stringify(await (await request.get("/api/tasks?status=open")).json())).toContain(
    "E2E restore canary",
  );

  await page.reload();
  await section.getByRole("button", { name: `Restore ${mine.file}` }).click();
  const dlg = page.getByRole("dialog", { name: "Restore this backup?" });
  await expect(dlg.getByRole("list", { name: "Backup contents" })).toContainText("accounts");
  const go = dlg.getByRole("button", { name: "Restore", exact: true });
  await expect(go).toBeDisabled();
  await dlg.getByLabel("Type RESTORE to confirm").fill("RESTORE");
  await go.click();
  await expect(page.getByText("Backup restored")).toBeVisible({ timeout: 120_000 });

  expect(JSON.stringify(await (await request.get("/api/tasks?status=open")).json())).not.toContain(
    "E2E restore canary",
  );
  const after = (await (await request.get("/api/backups")).json()) as {
    items: Array<{ kind: string }>;
  };
  expect(after.items.some((b) => b.kind === "pre-restore")).toBe(true);
  const audit = await (await request.get("/api/audit?action=backup.restore")).json();
  expect(audit.items.length).toBeGreaterThan(0);
  // Unknown or traversal names are refused.
  expect((await request.get("/api/backups/..%2F.env.local")).status()).toBe(400);
});
