import { buildDocument } from "@/lib/export/build";
import { ExportConfigSchema } from "@/lib/export/config";
import { handler, json, readJson } from "@/lib/server/http";

/** Live preview: the same document as the export, but hidden content is marked instead of removed. */
export const POST = handler(async (req: Request) => {
  const body = (await readJson(req)) as { config?: unknown; mode?: "preview" | "apply" };
  const config = ExportConfigSchema.parse(body.config);
  return json(await buildDocument(config, { mode: body.mode === "apply" ? "apply" : "preview" }));
});
