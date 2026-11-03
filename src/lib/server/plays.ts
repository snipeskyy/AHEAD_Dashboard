import "server-only";
import type { Play } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { recommendPlays, type PlayLite } from "@/lib/demand-gen/recommender";
import { HttpError } from "./http";

export const PlayBody = z.object({
  name: z.string().trim().min(3).max(120),
  practiceArea: z.string().min(1),
  targetPersonas: z.array(z.string().trim().min(1)).max(12),
  triggerKeywords: z.array(z.string().trim().min(1)).max(30),
  triggerSignalTypes: z.array(z.string()).max(12),
  valueHypothesis: z.string().trim().min(5).max(1000),
  talkTrack: z.array(z.string().trim().min(1)).max(12),
  sequence: z
    .array(
      z.object({
        day: z.number().int().min(0).max(365),
        channel: z.string(),
        description: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(15),
  assetsNeeded: z.array(z.string().trim().min(1)).max(12),
  successMetrics: z.array(z.string().trim().min(1)).max(12),
});

export type PlayDTO = Omit<
  Play,
  | "targetPersonas"
  | "triggerKeywords"
  | "triggerSignalTypes"
  | "talkTrack"
  | "sequence"
  | "assetsNeeded"
  | "successMetrics"
> &
  z.infer<typeof PlayBody>;

export const toPlayDTO = (p: Play): PlayDTO => ({
  ...p,
  targetPersonas: p.targetPersonas as string[],
  triggerKeywords: p.triggerKeywords as string[],
  triggerSignalTypes: p.triggerSignalTypes as string[],
  talkTrack: p.talkTrack as string[],
  sequence: p.sequence as PlayDTO["sequence"],
  assetsNeeded: p.assetsNeeded as string[],
  successMetrics: p.successMetrics as string[],
});

export const toPlayLite = (p: PlayDTO): PlayLite => ({
  id: p.id,
  name: p.name,
  practiceArea: p.practiceArea,
  targetPersonas: p.targetPersonas,
  triggerKeywords: p.triggerKeywords,
  triggerSignalTypes: p.triggerSignalTypes,
});

export async function listPlays() {
  return (await db.play.findMany({ orderBy: { name: "asc" } })).map(toPlayDTO);
}

/** Builds the recommender context for an account from live data. */
export async function recommendForAccount(accountId: string, max = 5) {
  const since = new Date(Date.now() - 45 * 86_400_000);
  const account = await db.account.findUnique({
    where: { id: accountId },
    include: {
      practiceStatus: true,
      initiatives: true,
      contacts: { select: { title: true, buyingRole: true, engagement: true } },
      signals: {
        where: { publishedAt: { gte: since }, dismissed: false },
        orderBy: { relevance: "desc" },
        take: 40,
        select: { id: true, title: true, type: true, practiceTags: true, relevance: true },
      },
      campaigns: { where: { status: { in: ["active", "planned"] } }, select: { playId: true } },
    },
  });
  if (!account) throw new HttpError(404, "Account not found");
  const plays = await listPlays();
  const recs = recommendPlays(
    plays.map(toPlayLite),
    {
      practiceStatus: Object.fromEntries(
        account.practiceStatus.map((p) => [p.practiceArea, p.status]),
      ),
      initiatives: account.initiatives.map((i) => ({
        title: i.title,
        practiceAreas: i.practiceAreas as string[],
        confidence: i.confidence,
      })),
      signals: account.signals.map((s) => ({ ...s, practiceTags: s.practiceTags as string[] })),
      personas: account.contacts,
      runningPlayIds: account.campaigns.map((c) => c.playId).filter((x): x is string => !!x),
    },
    max,
  );
  const byId = new Map(plays.map((p) => [p.id, p]));
  return {
    account: { id: account.id, name: account.name, tier: account.tier },
    items: recs.map((r) => ({ ...r, play: byId.get(r.play.id)! })),
  };
}
