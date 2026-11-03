import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "./http";
import { logActivity } from "./activity";

export const PlaySequenceSchema = z.array(
  z.object({ day: z.number().int().min(0).max(365), channel: z.string(), description: z.string() }),
);

const DAY = 86_400_000;

/**
 * Launch a play for an account: creates a Campaign and one planned Touch per sequence step
 * (scheduled at start + day offset, 10:00 local-ish), optionally linked to the triggering signal.
 */
export async function launchPlay(input: {
  playId: string;
  accountId: string;
  startDate?: Date;
  persona?: string | null;
  sourceSignalId?: string | null;
  name?: string;
}) {
  const [play, account] = await Promise.all([
    db.play.findUnique({ where: { id: input.playId } }),
    db.account.findUnique({ where: { id: input.accountId }, select: { id: true, name: true } }),
  ]);
  if (!play) throw new HttpError(404, "Play not found");
  if (!account) throw new HttpError(404, "Account not found");
  const start = input.startDate ?? new Date();
  start.setUTCHours(15, 0, 0, 0);
  const steps = PlaySequenceSchema.parse(play.sequence);
  const personas = (play.targetPersonas as string[]) ?? [];
  const campaign = await db.campaign.create({
    data: {
      name: input.name ?? `${play.name} — ${account.name}`,
      accountId: account.id,
      playId: play.id,
      status: "active",
      startDate: start,
      touches: {
        create: steps.map((st, i) => ({
          accountId: account.id,
          channel: st.channel,
          persona: input.persona ?? personas[i % Math.max(1, personas.length)] ?? "Economic Buyer",
          angle: `${play.name}: ${st.description}`,
          scheduledAt: new Date(start.getTime() + st.day * DAY),
          sourceSignalId: input.sourceSignalId ?? null,
        })),
      },
    },
    include: { touches: true },
  });
  await logActivity({
    entityType: "account",
    entityId: account.id,
    action: "campaign.launched",
    summary: `Launched play "${play.name}" (${steps.length} touches)`,
  });
  return campaign;
}
