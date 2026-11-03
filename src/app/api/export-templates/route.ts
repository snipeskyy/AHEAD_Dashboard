import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_TEMPLATES } from "@/lib/export/config";
import { handler, json, readJson } from "@/lib/server/http";

async function ensureDefaults() {
  if ((await db.exportTemplate.count()) > 0) return;
  await db.exportTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((t) => ({ name: t.name, config: t.config })),
  });
}

export const GET = handler(async () => {
  await ensureDefaults();
  return json({ items: await db.exportTemplate.findMany({ orderBy: { name: "asc" } }) });
});

export const POST = handler(async (req: Request) => {
  const { name, config } = z
    .object({ name: z.string().trim().min(2).max(80), config: z.record(z.string(), z.unknown()) })
    .parse(await readJson(req));
  const t = await db.exportTemplate.upsert({
    where: { name },
    create: { name, config: config as object },
    update: { config: config as object },
  });
  return json(t, { status: 201 });
});
