import "server-only";

/**
 * PDF via headless Chromium printing the dedicated print route. Uses the locally installed
 * Playwright browser (run `npx playwright install chromium` once on a new machine).
 */
export async function renderPdf(
  printUrl: string,
  /** Document footer; null for decks (16:9 pages, slides carry their own footer). */
  footer: { left: string; right: string } | null,
): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ colorScheme: "light" });
    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForSelector("[data-print-ready]", { timeout: 30_000 });
    await page.emulateMedia({ media: "print" });
    const esc = (s: string) =>
      s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    if (!footer) return await page.pdf({ width: "13.333in", height: "7.5in", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.6in", bottom: "0.7in", left: "0.6in", right: "0.6in" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font-family: Helvetica, Arial, sans-serif; font-size:8px; color:#5c5b57; width:100%; padding:0 0.6in; display:flex; justify-content:space-between;"><span>${esc(footer.left)}</span><span>${esc(footer.right)} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
}
