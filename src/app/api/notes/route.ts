import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";

const Body = z.object({
  entityType: z.enum(["account", "opportunity", "signal", "play", "event"]),
  entityId: z.string().min(1),
  body: z.string().trim().min(1).max(20_000),
  internalOnly: z.boolean().default(true),
});

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const items = await db.note.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return json({ items });
});

export const POST = handler(async (req: Request) => {
  const data = Body.parse(await readJson(req));
  const note = await db.note.create({ data });
  await logActivity({
    entityType: data.entityType,
    entityId: data.entityId,
    action: "note.created",
    summary: `Note added: ${data.body.slice(0, 80)}`,
  });
  return json(note, { status: 201 });
});
