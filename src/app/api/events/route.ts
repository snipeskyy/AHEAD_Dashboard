import { z } from "zod";
import { db } from "@/lib/db";
import { EVENT_KINDS } from "@/lib/domain/enums";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async () => {
  const rows = await db.event.findMany({
    orderBy: { startsAt: "asc" },
    include: { invites: { include: { account: { select: { name: true, tier: true } } } } },
  });
  return json({
    items: rows.map((e) => ({
      ...e,
      startsAt: e.startsAt.toISOString(),
      invites: e.invites.map((i) => ({
        id: i.id,
        accountId: i.accountId,
        accountName: i.account.name,
        tier: i.account.tier,
        persona: i.persona,
        status: i.status,
      })),
    })),
  });
});

const EventBody = z.object({
  name: z.string().trim().min(3).max(160),
  kind: z.enum(EVENT_KINDS),
  startsAt: z.coerce.date(),
  location: z.string().trim().max(160).nullish(),
});

export const POST = handler(async (req: Request) => {
  const b = EventBody.parse(await readJson(req));
  return json(await db.event.create({ data: { ...b, location: b.location ?? null } }), {
    status: 201,
  });
});
