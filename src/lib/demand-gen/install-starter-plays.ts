import type { PrismaClient } from "@prisma/client";
import { STARTER_PLAYS } from "./starter-plays";

/** Setting key set when the user clears the Starter Plays, so they are not reinstalled. */
export const STARTER_PLAYS_CLEARED_KEY = "demandGen.starterPlaysCleared";

export const starterPlayId = (slug: string) => `starter-${slug}`;

/**
 * Installs the generic Starter Plays (methodology, not account data) when the library is empty and
 * the user hasn't cleared them. Idempotent; returns the number of plays created.
 */
export async function ensureStarterPlays(db: PrismaClient, opts: { force?: boolean } = {}) {
  if (!opts.force) {
    const [count, cleared] = await Promise.all([
      db.play.count(),
      db.setting.findUnique({ where: { key: STARTER_PLAYS_CLEARED_KEY } }),
    ]);
    if (count > 0 || cleared?.value === true) return 0;
  }
  const existing = new Set((await db.play.findMany({ select: { slug: true } })).map((p) => p.slug));
  const rows = STARTER_PLAYS.filter((p) => !existing.has(p.slug)).map((p) => ({
    ...p,
    id: starterPlayId(p.slug),
    origin: "starter",
    isDemo: false,
  }));
  if (rows.length) await db.play.createMany({ data: rows });
  if (opts.force) await db.setting.deleteMany({ where: { key: STARTER_PLAYS_CLEARED_KEY } });
  return rows.length;
}

/** Removes every Starter Play that no campaign uses and remembers the choice. */
export async function clearStarterPlays(db: PrismaClient) {
  const { count } = await db.play.deleteMany({
    where: { origin: "starter", campaigns: { none: {} } },
  });
  const kept = await db.play.count({ where: { origin: "starter" } });
  await db.setting.upsert({
    where: { key: STARTER_PLAYS_CLEARED_KEY },
    create: { key: STARTER_PLAYS_CLEARED_KEY, value: true },
    update: { value: true },
  });
  return { removed: count, keptInUse: kept };
}
