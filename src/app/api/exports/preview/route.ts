import { withSlideCharts } from "@/lib/deck/charts.server";
import { planSlides } from "@/lib/deck/plan";
import { resolveDeckTheme } from "@/lib/deck/theme.server";
import { buildDocument } from "@/lib/export/build";
import { ExportConfigSchema } from "@/lib/export/config";
import { handler, json, readJson } from "@/lib/server/http";

/**
 * Live preview: the same document as the export, but hidden content is marked instead of removed.
 * `view: "deck"` also returns the planned slides (hidden ones included, flagged) and the theme.
 */
export const POST = handler(async (req: Request) => {
  const body = (await readJson(req)) as { config?: unknown; mode?: "preview" | "apply"; view?: "document" | "deck" };
  const config = ExportConfigSchema.parse(body.config);
  const doc = await buildDocument(config, { mode: body.mode === "apply" ? "apply" : "preview" });
  if (body.view !== "deck") return json(doc);
  const [slides, theme] = [withSlideCharts(planSlides(doc, config.deck, { keepHidden: true })), await resolveDeckTheme(config.theme)];
  return json({ ...doc, deck: { slides, theme } });
});
