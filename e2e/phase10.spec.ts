import { expect, test } from "@playwright/test";

/** Phase 10: presentation-grade deliverables (deck preview, presenter, PPTX + 16:9 PDF). */

/** Lists file names inside a zip (PPTX) from its central directory, without extra dependencies. */
function zipNames(buf: Buffer) {
  const names: string[] = [];
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let off = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const n = buf.readUInt16LE(off + 28),
      x = buf.readUInt16LE(off + 30),
      c = buf.readUInt16LE(off + 32);
    names.push(buf.subarray(off + 46, off + 46 + n).toString());
    off += 46 + n + x + c;
  }
  return names;
}

const CONFIG = {
  title: "Example QBR",
  scope: { type: "account", accountIds: ["demo-acc-008"] },
  sections: [
    "exports.cover",
    "exports.exec-summary",
    "opportunities.pipeline",
    "exports.next-steps",
  ],
  audience: "internal",
  style: "deck",
  preparedBy: "E2E",
};

test.describe("Phase 10: deliverables", () => {
  test("deck template → slide preview → hide a slide → present with keys", async ({ page }) => {
    await page.goto("/exports?account=demo-acc-008");
    await page.getByRole("combobox", { name: "Apply a template" }).click();
    await page.getByRole("option", { name: "Customer QBR deck (customer-facing)" }).click();
    await expect(page.getByRole("radio", { name: "Slide deck" })).toHaveAttribute(
      "data-state",
      "on",
    );
    const slides = page.getByRole("list", { name: "Slides" });
    await expect(slides.getByRole("listitem").first()).toBeVisible({ timeout: 30_000 });
    const status = page.getByText(/^\d+ slides$/);
    const before = Number((await status.innerText()).split(" ")[0]);
    expect(before).toBeGreaterThan(4);
    await slides.getByRole("button", { name: "Hide slide: Agenda" }).click();
    await expect(status).toHaveText(`${before - 1} slides`);
    await expect(slides.getByRole("button", { name: "Show slide: Agenda" })).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/light/exports-deck.png", fullPage: true });
    await page.getByRole("button", { name: "Present", exact: true }).click();
    const presenter = page.getByRole("dialog", { name: /Presenting slide 1 of/ });
    await expect(presenter).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog", { name: /Presenting slide 2 of/ })).toBeVisible();
    await page.keyboard.press("n");
    await page.screenshot({ path: "screenshots/light/exports-presenter.png" });
    await expect(
      page.getByRole("dialog", { name: /Presenting/ }).getByLabel("Speaker notes", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /Presenting/ })).toBeHidden();
  });

  test("PowerPoint has native charts and speaker notes; PDF deck is 16:9", async ({ request }) => {
    const p = await (
      await request.post("/api/exports", { data: { format: "pptx", config: CONFIG } })
    ).json();
    const pptx = Buffer.from(await (await request.get(`/api/exports/${p.job.id}/download`)).body());
    const names = zipNames(pptx);
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length).toBeGreaterThan(4);
    expect(names.some((n) => n.startsWith("ppt/charts/"))).toBe(true); // editable charts, not images
    expect(names.some((n) => n.startsWith("ppt/notesSlides/"))).toBe(true);

    const d = await (
      await request.post("/api/exports", { data: { format: "pdf", config: CONFIG } })
    ).json();
    const pdf = (await (await request.get(`/api/exports/${d.job.id}/download`)).body()).toString(
      "latin1",
    );
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf).toMatch(/\/MediaBox \[0 0 96\d(\.\d+)? 540\]/); // 13.333in × 7.5in at 72pt/in
  });

  test("executive summary and next steps are built from recorded data", async ({ request }) => {
    const doc = await (
      await request.post("/api/exports/preview", {
        data: { config: { ...CONFIG, style: "document" } },
      })
    ).json();
    const exec = doc.sections.find((s: { id: string }) => s.id === "exports.exec-summary");
    expect(JSON.stringify(exec)).toContain("Their priorities");
    expect(JSON.stringify(exec)).toContain("Where we can help");
    const next = doc.sections.find((s: { id: string }) => s.id === "exports.next-steps");
    expect(next.blocks.length).toBeGreaterThan(0);
  });
});
