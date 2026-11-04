"use client";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetList, WidgetRow } from "@/components/widget/widget-list";
import { formatCurrencyCompact } from "@/lib/format";
import type { WidgetProps } from "@/modules/types";
import { useOpportunities } from "../hooks/use-opportunities";
import { NoOppsEmpty } from "./no-opps";

export default function StalledDealsWidget({ height }: WidgetProps) {
  const { data, isLoading } = useOpportunities();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <NoOppsEmpty height={height} />;
  const rows = (data ?? [])
    .filter((o) => o.riskFlags.includes("stalled"))
    .sort((a, b) => b.amount - a.amount);
  return (
    <WidgetList height={height} empty="No stalled deals — nice.">
      {rows.map((o) => (
        <WidgetRow key={o.id}>
          <Link
            href={`/opportunities?focus=${o.id}`}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{o.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {o.stage} for{" "}
                <span className="text-warning-text font-medium">{o.daysInStage} days</span> ·{" "}
                {o.accountName}
              </div>
            </div>
            <span className="tabular shrink-0 text-[13px] font-medium" data-internal-only="true">
              {formatCurrencyCompact(o.amount)}
            </span>
          </Link>
        </WidgetRow>
      ))}
    </WidgetList>
  );
}
