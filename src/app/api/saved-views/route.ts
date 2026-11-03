import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  scope: z.string().min(1).max(60),
  name: z.string().trim().min(1).max(60),
  config: z.record(z.string(), z.unknown()),
});

export const GET = handler(async (req: Request) => {
  const scope = new URL(req.url).searchParams.get("scope") ?? undefined;
  return json({
    items: await db.savedView.findMany({ where: { scope }, orderBy: { name: "asc" } }),
  });
});

export const POST = handler(async (req: Request) => {
  const { scope, name, config } = Body.parse(await readJson(req));
  const view = await db.savedView.upsert({
    where: { scope_name: { scope, name } },
    create: { scope, name, config: config as object },
    update: { config: config as object },
  });
  return json(view, { status: 201 });
});
