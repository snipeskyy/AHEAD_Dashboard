import seedrandom from "seedrandom";
import { generateSignalContent } from "../../../../prisma/seed/generators/signals";
import { createRng } from "../../../../prisma/seed/rng";
import type { DataAdapter, NormalizedSignal } from "../types";

/**
 * Demo-only "live" simulator: emits 1–3 synthetic signals for random FICTIONAL demo accounts
 * per scheduler tick so the live feed / SSE can be demonstrated offline. Never touches real accounts.
 */
export const demoSimulatorAdapter: DataAdapter<NormalizedSignal, null> = {
  id: "seed",
  label: "Demo live simulator",
  kind: "seed",
  description:
    "Generates occasional synthetic signals for fictional demo accounts so the live feed can be demonstrated offline.",
  eligible: (a) => a.isDemo,
  async fetch(ctx) {
    return simulate(ctx.accounts.filter(this.eligible!), ctx.now);
  },
  /** No raw payload: the simulator produces normalized items directly. */
  normalize() {
    return [];
  },
};

export function simulate(
  accounts: Array<{ id: string; name: string; tier: string }>,
  now: Date,
  seed?: string,
): NormalizedSignal[] {
  if (!accounts.length) return [];
  const rand = seedrandom(seed ?? String(now.getTime()));
  const rng = createRng(seed ?? String(now.getTime()));
  const n = 1 + Math.floor(rand() * 3);
  const weighted = accounts.flatMap((a) =>
    a.tier === "Strategic" ? [a, a, a] : a.tier === "Growth" ? [a, a] : [a],
  );
  return Array.from({ length: n }, (_, i) => {
    const a = weighted[Math.floor(rand() * weighted.length)];
    const c = generateSignalContent(rng, a.name, "");
    return {
      accountId: a.id,
      type: c.type,
      title: c.title,
      summary: c.summary,
      url: null,
      source: "seed",
      publishedAt: new Date(now.getTime() - i * 60_000),
      dedupeKey: `sim:${now.getTime()}:${i}`,
    };
  });
}
