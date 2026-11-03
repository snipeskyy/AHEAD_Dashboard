import { z } from "zod";
import { db } from "@/lib/db";
import { launchPlay } from "@/lib/server/campaigns";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const accountId = new URL(req.url).searchParams.get("accountId") ?? undefined;
  const rows = await db.campaign.findMany({
    where: { accountId },
    orderBy: { startDate: "desc" },
    include: {
      account: { select: { name: true } },
      play: { select: { name: true, practiceArea: true } },
      touches: { select: { id: true, completedAt: true, outcome: true, scheduledAt: true } },
    },
  });
  return json({
    items: rows.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      startDate: c.startDate.toISOString(),
      accountId: c.accountId,
      accountName: c.account?.name ?? null,
      playId: c.playId,
      playName: c.play?.name ?? null,
      practiceArea: c.play?.practiceArea ?? null,
      touches: c.touches.length,
      completed: c.touches.filter((t) => t.completedAt).length,
      meetings: c.touches.filter((t) => t.outcome === "meeting" || t.outcome === "opp-created")
        .length,
      nextTouchAt:
        c.touches
          .filter((t) => !t.completedAt)
          .map((t) => t.scheduledAt)
          .sort((a, b) => a.getTime() - b.getTime())[0]
          ?.toISOString() ?? null,
    })),
  });
});

const Launch = z.object({
  playId: z.string().min(1),
  accountId: z.string().min(1),
  startDate: z.coerce.date().optional(),
  persona: z.string().max(120).optional(),
});

export const POST = handler(async (req: Request) => {
  const b = Launch.parse(await readJson(req));
  const c = await launchPlay(b);
  return json({ id: c.id, touches: c.touches.length }, { status: 201 });
});
