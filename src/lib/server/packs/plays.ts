import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { roleById } from "@/config/roles";
import { currentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";

/** Shared Play Library (Phase 8): methodology only, no account data, so the whole play travels. */
const J = z.array(z.unknown()).max(200);
const PlaySchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  practiceArea: z.string().max(60),
  targetPersonas: J, triggerKeywords: J, triggerSignalTypes: J,
  valueHypothesis: z.string().max(4000),
  talkTrack: J, sequence: J, assetsNeeded: J, successMetrics: J,
});
export const PlayPackSchema = z.object({
  format: z.literal("acc-plays"),
  version: z.literal(1),
  createdAt: z.string(),
  createdBy: z.object({ name: z.string().max(120), role: z.string().max(60) }),
  plays: z.array(PlaySchema).min(1).max(500),
});
export type PlayPack = z.infer<typeof PlayPackSchema>;

const fingerprint = (p: Record<string, unknown>) =>
  JSON.stringify(["name", "practiceArea", "valueHypothesis", "talkTrack", "sequence", "triggerKeywords"].map((k) => p[k]));

export async function exportPlays(ids?: string[]): Promise<PlayPack> {
  const me = await currentUser();
  const plays = await db.play.findMany({ where: { isDemo: false, ...(ids?.length ? { id: { in: ids } } : {}) }, orderBy: { name: "asc" } });
  await audit(db, { action: "plays.export", entityType: "play", summary: `Exported ${plays.length} plays to share` });
  return {
    format: "acc-plays",
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy: { name: me.displayName, role: roleById(me.role).label },
    plays: plays.map((p) => ({
      slug: p.slug, name: p.name, practiceArea: p.practiceArea, valueHypothesis: p.valueHypothesis,
      targetPersonas: p.targetPersonas as unknown[], triggerKeywords: p.triggerKeywords as unknown[], triggerSignalTypes: p.triggerSignalTypes as unknown[],
      talkTrack: p.talkTrack as unknown[], sequence: p.sequence as unknown[], assetsNeeded: p.assetsNeeded as unknown[], successMetrics: p.successMetrics as unknown[],
    })),
  };
}

/** What importing would do: new plays, changed plays (same slug, different content) and identical ones. */
export async function planPlays(pack: PlayPack) {
  const existing = new Map((await db.play.findMany({ where: { slug: { in: pack.plays.map((p) => p.slug) } } })).map((p) => [p.slug, p]));
  return pack.plays.map((p) => {
    const e = existing.get(p.slug);
    const status = !e ? "new" : fingerprint(e as unknown as Record<string, unknown>) === fingerprint(p) ? "same" : "changed";
    return { slug: p.slug, name: p.name, practiceArea: p.practiceArea, status };
  });
}

/** Adds new plays; `overwrite` also updates changed ones (to standardize on the team's version). */
export async function importPlays(pack: PlayPack, opts: { overwrite: boolean }) {
  const plan = await planPlays(pack);
  let created = 0, updated = 0, skipped = 0;
  for (const p of pack.plays) {
    const status = plan.find((x) => x.slug === p.slug)!.status;
    const data = { ...p, targetPersonas: p.targetPersonas as Prisma.InputJsonValue, triggerKeywords: p.triggerKeywords as Prisma.InputJsonValue, triggerSignalTypes: p.triggerSignalTypes as Prisma.InputJsonValue, talkTrack: p.talkTrack as Prisma.InputJsonValue, sequence: p.sequence as Prisma.InputJsonValue, assetsNeeded: p.assetsNeeded as Prisma.InputJsonValue, successMetrics: p.successMetrics as Prisma.InputJsonValue };
    if (status === "new") {
      await db.play.create({ data: { ...data, origin: "imported" } });
      created++;
    } else if (status === "changed" && opts.overwrite) {
      await db.play.update({ where: { slug: p.slug }, data: { ...data, origin: "imported" } });
      updated++;
    } else skipped++;
  }
  await audit(db, { action: "plays.import", entityType: "play", summary: `Imported plays from ${pack.createdBy.name}: ${created} new, ${updated} updated, ${skipped} unchanged/skipped` });
  return { created, updated, skipped };
}
