import { z } from "zod";
import { db } from "@/lib/db";
import { EXPORT_FORMATS } from "@/lib/export/config";
import { createExport } from "@/lib/server/exports";
import { handler, json, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const items = await db.exportJob.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return json({
    items: items.map((j) => ({
      ...j,
      audience: (j.config as { audience?: string }).audience ?? "internal",
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const body = z
    .object({ config: z.unknown(), format: z.enum(EXPORT_FORMATS) })
    .parse(await readJson(req));
  return json(await createExport(body.config, body.format, new URL(req.url).origin), {
    status: 201,
  });
});
