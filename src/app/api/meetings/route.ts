import { db } from "@/lib/db";
import { handler, json } from "@/lib/server/http";
import { listMeetings } from "@/lib/server/meetings";

export const GET = handler(async (req: Request) => {
  const days = Math.min(60, Number(new URL(req.url).searchParams.get("days") ?? 14));
  const from = new Date(new Date().setHours(0, 0, 0, 0));
  return json({ items: await listMeetings(from, new Date(from.getTime() + days * 86_400_000)) });
});

/** Remove all imported meetings (re-import any time). */
export const DELETE = handler(async () => json(await db.meeting.deleteMany({})));
