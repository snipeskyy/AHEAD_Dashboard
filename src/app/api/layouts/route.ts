import { z } from "zod";
import { db } from "@/lib/db";
import { LayoutWidgetsSchema } from "@/lib/dashboard/layouts";
import { ensureDefaultLayouts } from "@/lib/server/layouts";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async () => {
  await ensureDefaultLayouts();
  return json({
    items: await db.dashboardLayout.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  });
});

const Body = z.object({ name: z.string().trim().min(1).max(60), widgets: LayoutWidgetsSchema });

export const POST = handler(async (req: Request) => {
  const { name, widgets } = Body.parse(await readJson(req));
  const max = await db.dashboardLayout.aggregate({ _max: { sortOrder: true } });
  const exists = await db.dashboardLayout.findUnique({ where: { name } });
  const finalName = exists ? `${name} (${new Date().toISOString().slice(11, 16)})` : name;
  return json(
    await db.dashboardLayout.create({
      data: { name: finalName, widgets, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    }),
    { status: 201 },
  );
});
