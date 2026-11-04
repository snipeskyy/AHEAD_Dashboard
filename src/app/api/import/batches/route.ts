import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

/** Import history, newest first. */
export const GET = handler(async () => {
  const items = await db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { records: true } } },
  });
  return json({ items });
});
