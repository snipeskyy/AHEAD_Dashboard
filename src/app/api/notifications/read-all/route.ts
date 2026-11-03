import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";

export const POST = handler(async () => {
  const r = await db.notification.updateMany({ where: { read: false }, data: { read: true } });
  return json({ updated: r.count });
});
