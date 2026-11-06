import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

/** Audit log, newest first, cursor-paginated. Optional filter by action prefix (e.g. "import", "delete"). */
export const GET = handler(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const q = z.object({ action: z.string().max(40).optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse({
    action: p.get("action") ?? undefined, cursor: p.get("cursor") ?? undefined, limit: p.get("limit") ?? undefined,
  });
  const rows = await db.auditLog.findMany({
    where: q.action ? { action: { startsWith: q.action } } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const users = new Map((await db.user.findMany({ select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
  const items = rows.slice(0, q.limit).map((r) => ({ ...r, actorName: users.get(r.actorId) ?? (r.actorId === "system" ? "System (worker)" : r.actorId) }));
  return json({ items, nextCursor: rows.length > q.limit ? items[items.length - 1].id : null });
});
