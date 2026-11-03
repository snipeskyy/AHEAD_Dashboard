import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export const GET = handler(async () => {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { read: false } }),
  ]);
  return json({ items, unread });
});
