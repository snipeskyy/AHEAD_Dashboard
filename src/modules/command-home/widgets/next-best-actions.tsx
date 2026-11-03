"use client";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, KanbanSquare, ListChecks, Radio, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetList, WidgetRow } from "@/components/widget/widget-list";
import { api } from "@/lib/api-client";
import type { NextAction } from "@/lib/dashboard/next-actions";
import type { WidgetProps } from "@/modules/types";

const ICON: Record<NextAction["kind"], LucideIcon> = {
  deal: KanbanSquare,
  engage: CalendarCheck,
  plan: ListChecks,
  signal: Radio,
};

export default function NextBestActionsWidget({ height }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "next-actions"],
    queryFn: () => api<{ items: NextAction[] }>("/api/dashboard/next-actions").then((r) => r.items),
  });
  if (isLoading) return <Skeleton style={{ height }} />;
  return (
    <WidgetList height={height} empty="You're caught up.">
      {(data ?? []).map((a) => {
        const Icon = ICON[a.kind];
        return (
          <WidgetRow key={a.id}>
            <Link
              href={a.href}
              className="flex gap-2.5"
              data-internal-only={a.kind === "deal" ? "true" : undefined}
            >
              <span className="bg-brand-soft text-primary mt-0.5 grid size-6 shrink-0 place-items-center rounded-md">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{a.title}</div>
                <div className="text-muted-foreground text-xs">{a.why}</div>
              </div>
            </Link>
          </WidgetRow>
        );
      })}
    </WidgetList>
  );
}
