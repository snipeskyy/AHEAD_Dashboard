import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { SmartListBody } from "@/lib/server/smart-lists";

export const GET = handler(async () => json({ items: await db.smartList.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }) }));
export const POST = handler(async (req: Request) =>
  json(await db.smartList.create({ data: SmartListBody.parse(await readJson(req)) as Prisma.SmartListCreateInput }), { status: 201 }),
);
