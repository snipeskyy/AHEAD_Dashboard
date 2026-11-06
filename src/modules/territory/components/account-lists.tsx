"use client";
import { AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { TerritoryRow } from "./use-territory";

export function NeglectedList({ rows, max = 15 }: { rows: TerritoryRow[]; max?: number }) {
  return (
    <ul className="divide-y">
      {rows.slice(0, max).map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
          <Link href={`/accounts/${r.id}`} className="min-w-0 truncate font-medium hover:underline">{r.name}</Link>
          <span className="text-muted-foreground shrink-0 text-xs">
            <span className="mr-2">{r.tier}</span>
            <span className="text-critical-text inline-flex items-center gap-1">
              <AlertTriangle className="size-3" aria-hidden />
              {r.cadence.status === "never" ? "never touched" : `${r.cadence.daysSinceTouch}d since touch (every ${r.cadenceDays}d)`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MomentumList({ rows, max = 15 }: { rows: TerritoryRow[]; max?: number }) {
  return (
    <ul className="divide-y">
      {rows.slice(0, max).map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
          <Link href={`/accounts/${r.id}`} className="min-w-0 truncate font-medium hover:underline">{r.name}</Link>
          <span
            className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs"
            title={`Signals ${r.momentumParts.signals} · stage moves ${r.momentumParts.stageMoves} · touches ${r.momentumParts.touches} · new opps ${r.momentumParts.newOpps} (last 14 days)`}
          >
            <TrendingUp className="text-good-text size-3" aria-hidden /> {r.momentum}
          </span>
        </li>
      ))}
    </ul>
  );
}
