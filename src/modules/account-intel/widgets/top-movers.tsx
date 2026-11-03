"use client";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetList, WidgetRow } from "@/components/widget/widget-list";
import { api } from "@/lib/api-client";
import type { Mover } from "@/lib/dashboard/movers";
import type { WidgetProps } from "@/modules/types";

export default function TopMoversWidget({ height }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "movers"],
    queryFn: () => api<{ items: Mover[] }>("/api/dashboard/movers").then((r) => r.items),
  });
  if (isLoading) return <Skeleton style={{ height }} />;
  return (
    <WidgetList height={height} empty="No notable movement this week.">
      {(data ?? []).map((m) => (
        <WidgetRow key={m.accountId}>
          <Link href={`/accounts/${m.accountId}`} className="flex items-start gap-2.5">
            {m.direction === "up" ? (
              <TrendingUp className="text-good-text mt-0.5 size-4 shrink-0" aria-label="Up" />
            ) : (
              <TrendingDown
                className="text-critical-text mt-0.5 size-4 shrink-0"
                aria-label="Down"
              />
            )}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{m.accountName}</div>
              <div className="text-muted-foreground text-xs">{m.reasons.join(" · ")}</div>
            </div>
          </Link>
        </WidgetRow>
      ))}
    </WidgetList>
  );
}
