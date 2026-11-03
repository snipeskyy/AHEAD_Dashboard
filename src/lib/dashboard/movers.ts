/**
 * "Top movers this week": accounts with the most change in the last 7 days, scored from
 * stage advances, new pipeline, won/lost deals and high-relevance signals. Transparent reasons.
 */
export interface MoverInput {
  accountId: string;
  accountName: string;
  tier: string;
  advances: number; // forward stage moves (excl. lost)
  setbacks: number; // moves to ClosedLost or backwards
  wonAmount: number;
  newPipeline: number;
  highSignals: number;
}

export interface Mover {
  accountId: string;
  accountName: string;
  tier: string;
  direction: "up" | "down";
  score: number;
  reasons: string[];
}

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

export function moverScore(r: MoverInput): number {
  const pipe = r.newPipeline > 0 ? 2 + Math.log10(r.newPipeline / 1e5 + 1) * 2 : 0;
  return r.advances * 3 + r.highSignals + pipe + (r.wonAmount > 0 ? 4 : 0) - r.setbacks * 4;
}

export function topMovers(rows: MoverInput[], max = 8): Mover[] {
  return rows
    .map((r) => {
      const score = moverScore(r);
      const reasons: string[] = [];
      if (r.wonAmount) reasons.push(`won ${money(r.wonAmount)}`);
      if (r.advances) reasons.push(`${r.advances} stage advance${r.advances > 1 ? "s" : ""}`);
      if (r.newPipeline) reasons.push(`+${money(r.newPipeline)} new pipeline`);
      if (r.highSignals)
        reasons.push(`${r.highSignals} high-relevance signal${r.highSignals > 1 ? "s" : ""}`);
      if (r.setbacks) reasons.push(`${r.setbacks} setback${r.setbacks > 1 ? "s" : ""}`);
      return {
        accountId: r.accountId,
        accountName: r.accountName,
        tier: r.tier,
        direction: score >= 0 ? ("up" as const) : ("down" as const),
        score,
        reasons,
      };
    })
    .filter((m) => m.reasons.length > 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, max);
}
