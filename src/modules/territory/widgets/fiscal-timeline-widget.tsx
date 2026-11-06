"use client";
import { CalendarClock } from "lucide-react";
import { WidgetEmpty } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { FiscalTimeline } from "../components/fiscal-timeline";
import { useTerritory } from "../components/use-territory";

export default function FiscalTimelineWidget({ height, size }: WidgetProps) {
  const { data, isLoading } = useTerritory();
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.rows.some((r) => r.fiscal))
    return <WidgetEmpty height={height} icon={CalendarClock} title="No fiscal years yet" description="Fiscal year ends come from SEC filings (Enrich) or can be typed on an account's Profile tab." href="/accounts" cta="Open accounts" />;
  return (
    <div className="overflow-y-auto" style={{ height }}>
      <FiscalTimeline rows={data.rows} height={height - 8} max={size === "md" ? 8 : 15} />
    </div>
  );
}
