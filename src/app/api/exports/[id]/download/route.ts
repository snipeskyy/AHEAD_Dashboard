import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { FORMAT_META, type ExportFormat } from "@/lib/export/config";
import { EXPORT_DIR, slug } from "@/lib/server/exports";
import { HttpError, handler } from "@/lib/server/http";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const job = await db.exportJob.findUnique({ where: { id } });
  if (!job || job.status !== "done" || !job.outputPath)
    throw new HttpError(404, "Export file not available");
  const meta = FORMAT_META[job.format as ExportFormat];
  const body = await readFile(path.join(EXPORT_DIR, path.basename(job.outputPath)));
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": meta.mime,
      "content-disposition": `attachment; filename="${slug(job.title)}-v${job.version}.${meta.ext}"`,
    },
  });
});
