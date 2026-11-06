"use client";
import { differenceInCalendarDays, format } from "date-fns";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetList, WidgetRow } from "@/components/widget/widget-list";
import { formatCurrencyCompact } from "@/lib/format";
import type { WidgetProps } from "@/modules/types";
import { MeddpiccMeter } from "../components/badges";
import { useOpportunities } from "../hooks/use-opportunities";
import { NoOppsEmpty } from "./no-opps";

export default function UpcomingClosesWidget({ height }: WidgetProps) {
  const { data, isLoading } = useOpportunities();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <NoOppsEmpty height={height} />;
  const now = new Date();
  const rows = (data ?? [])
    .filter((o) => !o.stage.startsWith("Closed"))
    .map((o) => ({ o, d: differenceInCalendarDays(new Date(o.closeDate), now) }))
    .filter(({ d }) => d >= 0 && d <= 45)
    .sort((a, b) => a.d - b.d);
  return (
    <WidgetList height={height} empty="No deals closing in the next 45 days.">
      {rows.map(({ o, d }) => (
        <WidgetRow key={o.id}>
          <Link
            href={`/opportunities?focus=${o.id}`}
            className="flex items-center justify-between gap-3 hover:underline-offset-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{o.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {format(new Date(o.closeDate), "MMM d")} · {d === 0 ? "today" : `in ${d}d`} ·{" "}
                {o.stage}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1" data-internal-only="true">
              <span className="tabular text-[13px] font-medium">
                <span data-field="opp.amount">{formatCurrencyCompact(o.amount)}</span>
              </span>
              <MeddpiccMeter score={o.meddpiccScore} />
            </div>
          </Link>
        </WidgetRow>
      ))}
    </WidgetList>
  );
}
