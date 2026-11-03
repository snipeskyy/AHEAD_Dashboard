import { z } from "zod";
import { db } from "@/lib/db";
import { playsForSignal } from "@/lib/demand-gen/recommender";
import { HttpError, handler, json } from "@/lib/server/http";
import { listPlays, toPlayLite } from "@/lib/server/plays";

export const GET = handler(async (req: Request) => {
  const { signalId } = z
    .object({ signalId: z.string().min(1) })
    .parse(Object.fromEntries(new URL(req.url).searchParams));
  const s = await db.signal.findUnique({
    where: { id: signalId },
    select: { title: true, type: true, practiceTags: true },
  });
  if (!s) throw new HttpError(404, "Signal not found");
  const plays = await listPlays();
  const byId = new Map(plays.map((p) => [p.id, p]));
  const matches = playsForSignal(plays.map(toPlayLite), {
    ...s,
    practiceTags: s.practiceTags as string[],
  });
  return json({
    items: matches.map((m) => ({ play: byId.get(m.play.id)!, why: m.why })),
    all: plays.map((p) => ({ id: p.id, name: p.name, practiceArea: p.practiceArea })),
  });
});
