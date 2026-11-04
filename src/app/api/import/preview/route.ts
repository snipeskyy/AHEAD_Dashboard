import { PreviewBody } from "@/lib/import/schemas";
import { handler, json, readJson } from "@/lib/server/http";
import { planImport } from "@/lib/server/import/plan";

/** Validation, account matching and duplicate detection for every row. Read-only. */
export const POST = handler(async (req: Request) => {
  const { kind, rows } = PreviewBody.parse(await readJson(req));
  const plan = await planImport(kind, rows);
  const items = plan.map((p) => p.row);
  const summary = {
    total: items.length,
    new: items.filter((r) => r.status === "new").length,
    duplicate: items.filter((r) => r.status === "duplicate").length,
    error: items.filter((r) => r.status === "error").length,
  };
  return json({ summary, rows: items });
});
