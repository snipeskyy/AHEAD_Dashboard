"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNowStrict } from "date-fns";
import { FlaskConical } from "lucide-react";
import type { ColumnMetaExt } from "@/components/data-table";
import { MagnitudeBar, ScorePill } from "@/components/score-pill";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/format";
import type { AccountRow } from "../hooks/use-accounts";

type Col = ColumnDef<AccountRow, unknown> & { meta?: ColumnMetaExt<AccountRow> };

export function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge
      variant="outline"
      className={
        tier === "Strategic"
          ? "border-primary/40 bg-brand-soft text-primary font-medium"
          : "text-muted-foreground font-normal"
      }
    >
      {tier}
    </Badge>
  );
}

const ago = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : "—";

export const TIER_ORDER: Record<string, number> = { Strategic: 0, Growth: 1, Maintain: 2 };

export const accountColumns: Col[] = [
  {
    id: "name",
    header: "Account",
    accessorFn: (r) => r.name,
    meta: { width: 280, csv: (r) => r.name },
    cell: ({ row: { original: r } }) => (
      <div className="max-w-80 min-w-0">
        <div className="flex items-center gap-1.5 truncate font-medium">
          {r.name}
          {!r.isDemo && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              Real
            </Badge>
          )}
          {r.isDemo && (
            <FlaskConical
              className="text-muted-foreground size-3 shrink-0"
              aria-label="Demo account"
            />
          )}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {r.industry}
          {r.subIndustry ? ` · ${r.subIndustry}` : ""}
        </div>
      </div>
    ),
  },
  {
    id: "industry",
    header: "Industry",
    accessorFn: (r) => r.industry,
    filterFn: "includesSome" as never,
    meta: { csv: (r) => r.industry },
  },
  {
    id: "tier",
    header: "Tier",
    accessorFn: (r) => r.tier,
    sortingFn: (a, b) => TIER_ORDER[a.original.tier] - TIER_ORDER[b.original.tier],
    filterFn: "includesSome" as never,
    meta: { csv: (r) => r.tier, internalOnly: true },
    cell: ({ getValue }) => <TierBadge tier={getValue() as string} />,
  },
  {
    id: "health",
    header: "Health",
    accessorFn: (r) => r.healthScore,
    meta: { csv: (r) => r.healthScore, internalOnly: true },
    cell: ({ getValue }) => <ScorePill value={getValue() as number} label="Health" />,
  },
  {
    id: "whitespace",
    header: "Whitespace",
    accessorFn: (r) => r.whitespaceScore,
    meta: { csv: (r) => r.whitespaceScore, internalOnly: true },
    cell: ({ getValue }) => <MagnitudeBar value={getValue() as number} label="Whitespace" />,
  },
  {
    id: "pipeline",
    header: "Open pipeline",
    accessorFn: (r) => r.openPipeline,
    meta: { align: "right", csv: (r) => r.openPipeline, internalOnly: true },
    cell: ({ getValue }) => formatCurrencyCompact(getValue() as number),
  },
  {
    id: "opps",
    header: "Opps",
    accessorFn: (r) => r.openOpps,
    meta: { align: "right", csv: (r) => r.openOpps },
  },
  {
    id: "signals7d",
    header: "Signals 7d",
    accessorFn: (r) => r.signals7d,
    meta: { align: "right", csv: (r) => r.signals7d },
  },
  {
    id: "lastTouch",
    header: "Last touch",
    accessorFn: (r) => r.lastTouchAt ?? "",
    meta: { csv: (r) => r.lastTouchAt ?? "" },
    cell: ({ row: { original: r } }) => (
      <span className="text-muted-foreground">{ago(r.lastTouchAt)}</span>
    ),
  },
  {
    id: "nextTouch",
    header: "Next touch",
    accessorFn: (r) => r.nextTouchAt ?? "~",
    meta: { csv: (r) => r.nextTouchAt ?? "" },
    cell: ({ row: { original: r } }) => (
      <span className="text-muted-foreground">{ago(r.nextTouchAt)}</span>
    ),
  },
  { id: "hq", header: "HQ", accessorFn: (r) => r.hq ?? "", meta: { csv: (r) => r.hq ?? "" } },
  {
    id: "revenue",
    header: "Revenue",
    accessorFn: (r) => r.revenueBand ?? "",
    meta: { csv: (r) => r.revenueBand ?? "" },
  },
  {
    id: "domain",
    header: "Domain",
    accessorFn: (r) => r.domain ?? "",
    meta: { csv: (r) => r.domain ?? "" },
  },
];
