"use client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetList, WidgetRow } from "@/components/widget/widget-list";
import { practiceLabel } from "@/config/practice-areas";
import { api } from "@/lib/api-client";
import type { SignalRow } from "@/lib/server/signals";
import type { WidgetProps } from "@/modules/types";

/** Compact feed: highest-relevance signals from the last 7 days. */
export default function SignalFeedWidget({ height }: WidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "signal-feed"],
    queryFn: () =>
      api<{ items: SignalRow[] }>(
        "/api/signals?sinceDays=7&minRelevance=40&sort=relevance&limit=30",
      ).then((r) => r.items),
    refetchInterval: 60_000,
  });
  if (isLoading) return <Skeleton style={{ height }} />;
  return (
    <WidgetList height={height} empty="No high-relevance signals this week.">
      {(data ?? []).map((s) => (
        <WidgetRow key={s.id}>
          <Link href={`/signals?focus=${s.id}`} className="flex gap-3">
            <span
              className="tabular w-7 shrink-0 pt-0.5 text-right text-xs font-semibold"
              title="Relevance"
              data-internal-only="true"
            >
              {Math.round(s.relevance)}
            </span>
            <div className="min-w-0">
              <div className="line-clamp-2 text-[13px]">{s.title}</div>
              <div className="text-muted-foreground truncate text-[11px]">
                {s.accountName} ·{" "}
                {s.practiceTags.map((t) => practiceLabel(t, true)).join(", ") || "untagged"} ·{" "}
                {formatDistanceToNowStrict(new Date(s.publishedAt), { addSuffix: true })}
              </div>
            </div>
          </Link>
        </WidgetRow>
      ))}
    </WidgetList>
  );
}
