import { Building2, KanbanSquare, Radio, Target } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain/enums";
import { formatCurrencyCompact, formatNumber } from "@/lib/format";

/** Phase 1: workspace snapshot. Phase 2 replaces this with the customizable widget grid. */
async function loadSnapshot(now: Date) {
  const since = new Date(now.getTime() - 86_400_000);
  return Promise.all([
    db.account.count(),
    db.account.count({ where: { tier: "Strategic" } }),
    db.opportunity.aggregate({
      where: { stage: { in: [...OPEN_STAGES] } },
      _sum: { amount: true },
      _count: true,
    }),
    db.signal.count({ where: { publishedAt: { gte: since }, relevance: { gte: 50 } } }),
  ]);
}

export default async function HomePage() {
  const [accounts, strategic, open, signals24h] = await loadSnapshot(new Date());
  const tiles = [
    {
      label: "Accounts",
      value: formatNumber(accounts),
      sub: `${strategic} strategic`,
      icon: Building2,
    },
    {
      label: "Open pipeline",
      value: formatCurrencyCompact(open._sum.amount ?? 0),
      sub: `${open._count} active opportunities`,
      icon: KanbanSquare,
      internal: true,
    },
    {
      label: "High-relevance signals",
      value: formatNumber(signals24h),
      sub: "last 24 hours",
      icon: Radio,
    },
    {
      label: "Coverage target",
      value: "3.0×",
      sub: "set in Settings",
      icon: Target,
      internal: true,
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Command Home"
        title="Portfolio overview"
        description="A snapshot of your workspace. The customizable widget grid with saved layouts arrives in Phase 2."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            data-internal-only={t.internal ? "true" : undefined}
            className="bg-card rounded-lg border p-4"
          >
            <div className="text-muted-foreground flex items-center justify-between text-[13px]">
              {t.label}
              <t.icon className="size-4" aria-hidden />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{t.value}</div>
            <div className="text-muted-foreground mt-1 text-xs">{t.sub}</div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
