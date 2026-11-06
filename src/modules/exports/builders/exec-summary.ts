import "server-only";
import { practiceLabel } from "@/config/practice-areas";
import { money, perAccount } from "@/lib/export/build-helpers";
import type { BuildContext } from "@/lib/export/builder-types";
import type { Block } from "@/lib/export/types";

const OPEN = { notIn: ["ClosedWon", "ClosedLost"] };
const DAY = 86_400_000;

/**
 * Executive summary narrative (template-only): where the account is, its public priorities,
 * where we can help, each line built from recorded data with its source. Nothing is invented.
 */
export async function execSummary(ctx: BuildContext): Promise<Block[]> {
  if (ctx.scope === "portfolio" || ctx.accounts.length > 3) return portfolioSummary(ctx);
  return perAccount(ctx, async (acc) => {
    const since = new Date(ctx.now.getTime() - 90 * DAY);
    const [a, opps, signals, inits, statuses] = await Promise.all([
      ctx.db.account.findUniqueOrThrow({ where: { id: acc.id }, select: { name: true, industry: true, hq: true, employeeBand: true, revenueBand: true, healthScore: true, tier: true } }),
      ctx.db.opportunity.findMany({ where: { accountId: acc.id, stage: OPEN }, select: { amount: true, practiceArea: true } }),
      ctx.db.signal.count({ where: { accountId: acc.id, publishedAt: { gte: since }, dismissed: false } }),
      ctx.db.initiative.findMany({ where: { accountId: acc.id }, orderBy: { confidence: "desc" }, take: 5 }),
      ctx.db.accountPracticeStatus.findMany({ where: { accountId: acc.id } }),
    ]);
    const blocks: Block[] = [
      { kind: "heading", level: 3, text: `${a.name} today`, field: "situation" },
      {
        kind: "kv",
        field: "situation",
        items: [
          { label: "Industry", value: a.industry },
          ...(a.hq ? [{ label: "Headquarters", value: a.hq }] : []),
          ...(a.employeeBand || a.revenueBand ? [{ label: "Size", value: [a.employeeBand, a.revenueBand].filter(Boolean).join(" · ") }] : []),
          { label: "Open pipeline", value: money(opps.reduce((s, o) => s + o.amount, 0)), field: "pipeline" },
          { label: "Relationship health", value: `${Math.round(a.healthScore)}/100`, field: "pipeline" },
          { label: "Signals (90 days)", value: String(signals) },
        ],
      },
      { kind: "heading", level: 3, text: "Their priorities", field: "priorities" },
    ];
    if (inits.length)
      blocks.push({
        kind: "list",
        field: "priorities",
        items: inits.map((i) => ({
          text: i.title,
          sub: [i.source === "user-hypothesis" ? "Our hypothesis" : i.section ?? "Public source", i.evidence ? `“${i.evidence.slice(0, 140)}”` : null].filter(Boolean).join(" · "),
          href: i.sourceUrl ?? undefined,
        })),
      });
    else blocks.push({ kind: "paragraph", field: "priorities", text: "No initiative evidence recorded yet. Fetch public data or add what you know on the account." });

    // Where we can help: practices with initiative evidence and no active engagement yet.
    const engaged = new Set(statuses.filter((s) => ["ActiveOpp", "Delivered"].includes(s.status)).map((s) => s.practiceArea));
    const openPractices = new Set(opps.map((o) => o.practiceArea));
    const help = new Map<string, string>();
    for (const i of inits)
      for (const p of (i.practiceAreas as string[]) ?? [])
        if (!engaged.has(p) && !openPractices.has(p) && !help.has(p)) help.set(p, i.title);
    blocks.push({ kind: "heading", level: 3, text: "Where we can help", field: "pov" });
    blocks.push(
      help.size
        ? { kind: "list", field: "pov", items: [...help].slice(0, 5).map(([p, why]) => ({ text: practiceLabel(p), sub: `Linked to: ${why}` })) }
        : { kind: "paragraph", field: "pov", text: "Current engagements already cover the practices their public priorities point to." },
    );
    return blocks;
  });
}

async function portfolioSummary(ctx: BuildContext): Promise<Block[]> {
  const ids = ctx.accounts.map((a) => a.id);
  const [opps, inits] = await Promise.all([
    ctx.db.opportunity.findMany({ where: { accountId: { in: ids }, stage: OPEN }, select: { amount: true, accountId: true, practiceArea: true } }),
    ctx.db.initiative.findMany({ where: { accountId: { in: ids } }, select: { practiceAreas: true } }),
  ]);
  const byAcc = new Map<string, number>();
  for (const o of opps) byAcc.set(o.accountId, (byAcc.get(o.accountId) ?? 0) + o.amount);
  const themes = new Map<string, number>();
  for (const i of inits) for (const p of (i.practiceAreas as string[]) ?? []) themes.set(p, (themes.get(p) ?? 0) + 1);
  const names = new Map(ctx.accounts.map((a) => [a.id, a.name]));
  const top = [...byAcc].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return [
    { kind: "heading", level: 3, text: "Portfolio at a glance", field: "situation" },
    {
      kind: "kv",
      field: "situation",
      items: [
        { label: "Accounts", value: String(ctx.accounts.length) },
        { label: "Strategic", value: String(ctx.accounts.filter((a) => a.tier === "Strategic").length) },
        { label: "Open pipeline", value: money(opps.reduce((s, o) => s + o.amount, 0)), field: "pipeline" },
        { label: "Open deals", value: String(opps.length), field: "pipeline" },
      ],
    },
    { kind: "heading", level: 3, text: "Where the pipeline is", field: "pipeline" },
    { kind: "list", field: "pipeline", items: top.map(([id, v]) => ({ text: names.get(id) ?? id, sub: money(v) })) },
    { kind: "heading", level: 3, text: "What customers are prioritizing", field: "priorities" },
    {
      kind: "chart",
      field: "priorities",
      title: "Initiative evidence by practice",
      spec: {
        type: "hbar",
        categories: [...themes].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => practiceLabel(p)),
        series: [{ name: "Initiatives", values: [...themes].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([, n]) => n) }],
      },
    },
  ];
}
