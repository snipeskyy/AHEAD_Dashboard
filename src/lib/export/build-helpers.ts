import "server-only";
import type { BuildAccount, BuildContext } from "./builder-types";
import type { Block } from "./types";

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(n) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
export const pct = (r: number) => `${Math.round(r * 100)}%`;
export const day = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const MAX_PER_ACCOUNT = 10;

/**
 * For account-level sections: one block group per account (capped), with a heading
 * per account when more than one is in scope.
 */
export async function perAccount(
  ctx: BuildContext,
  fn: (a: BuildAccount) => Promise<Block[]>,
): Promise<Block[]> {
  const list = ctx.accounts.slice(0, MAX_PER_ACCOUNT);
  const out: Block[] = [];
  for (const a of list) {
    const blocks = await fn(a);
    if (!blocks.length) continue;
    if (list.length > 1) out.push({ kind: "heading", text: a.name, level: 3 });
    out.push(...blocks);
  }
  if (ctx.accounts.length > MAX_PER_ACCOUNT)
    out.push({
      kind: "callout",
      text: `Showing the first ${MAX_PER_ACCOUNT} of ${ctx.accounts.length} accounts in scope.`,
      tone: "info",
    });
  return out;
}

export const ids = (ctx: BuildContext) => ctx.accounts.map((a) => a.id);
