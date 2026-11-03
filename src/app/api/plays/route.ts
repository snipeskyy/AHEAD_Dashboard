import { db } from "@/lib/db";
import { logActivity } from "@/lib/server/activity";
import { handler, json, readJson } from "@/lib/server/http";
import { listPlays, PlayBody, toPlayDTO } from "@/lib/server/plays";

export const GET = handler(async () => {
  const plays = await listPlays();
  // Effectiveness: touches → meetings → opps for each play's campaigns.
  const touches = await db.touch.findMany({
    where: { campaign: { playId: { not: null } } },
    select: { outcome: true, completedAt: true, campaign: { select: { playId: true } } },
  });
  const stats = new Map<
    string,
    {
      campaigns: number;
      touches: number;
      completed: number;
      replies: number;
      meetings: number;
      opps: number;
    }
  >();
  const camps = await db.campaign.groupBy({ by: ["playId"], _count: true });
  for (const c of camps)
    if (c.playId)
      stats.set(c.playId, {
        campaigns: c._count,
        touches: 0,
        completed: 0,
        replies: 0,
        meetings: 0,
        opps: 0,
      });
  for (const t of touches) {
    const s = stats.get(t.campaign!.playId!);
    if (!s) continue;
    s.touches++;
    if (t.completedAt) s.completed++;
    if (t.outcome === "replied" || t.outcome === "meeting" || t.outcome === "opp-created")
      s.replies++;
    if (t.outcome === "meeting" || t.outcome === "opp-created") s.meetings++;
    if (t.outcome === "opp-created") s.opps++;
  }
  return json({
    items: plays.map((p) => ({
      ...p,
      stats: stats.get(p.id) ?? {
        campaigns: 0,
        touches: 0,
        completed: 0,
        replies: 0,
        meetings: 0,
        opps: 0,
      },
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const body = PlayBody.parse(await readJson(req));
  const slug = `${body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  const p = await db.play.create({ data: { ...body, slug } });
  await logActivity({
    entityType: "play",
    entityId: p.id,
    action: "play.created",
    summary: `Created play "${p.name}"`,
  });
  return json(toPlayDTO(p), { status: 201 });
});
