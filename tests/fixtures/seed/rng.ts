import seedrandom from "seedrandom";

/** Deterministic PRNG helpers. Same seed → same dataset (dates are relative to the anchor day). */
export function createRng(seed: string) {
  const r = seedrandom(seed);
  const api = {
    next: () => r(),
    int: (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min,
    float: (min: number, max: number) => r() * (max - min) + min,
    bool: (p = 0.5) => r() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    weighted: <T>(items: ReadonlyArray<readonly [T, number]>): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let x = r() * total;
      for (const [v, w] of items) {
        x -= w;
        if (x <= 0) return v;
      }
      return items[items.length - 1][0];
    },
    sample: <T>(arr: readonly T[], n: number): T[] => {
      const copy = [...arr];
      const out: T[] = [];
      while (out.length < n && copy.length)
        out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
      return out;
    },
    /** Log-normal-ish amount between min and max, rounded to $5k. */
    amount: (min: number, max: number) => {
      const v = Math.exp(Math.log(min) + Math.pow(r(), 1.6) * (Math.log(max) - Math.log(min)));
      return Math.round(v / 5000) * 5000;
    },
  };
  return api;
}
export type Rng = ReturnType<typeof createRng>;

export const DAY = 86_400_000;
export const daysFrom = (anchor: Date, days: number) => new Date(anchor.getTime() + days * DAY);
