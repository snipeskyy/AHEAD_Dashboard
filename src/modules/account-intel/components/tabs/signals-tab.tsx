"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { FilterChip } from "@/components/data-table";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { practiceLabel } from "@/config/practice-areas";
import { SIGNAL_TYPES, SIGNAL_TYPE_LABELS, type SignalType } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import type { SignalRow } from "@/lib/server/signals";

/** Account-scoped signal feed (server-paginated). Phase 3 adds live updates and actions. */
export function SignalsTab({ accountId }: { accountId: string }) {
  const [types, setTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<"recent" | "relevance">("recent");
  const q = useInfiniteQuery({
    queryKey: ["signals", accountId, types.join(","), sort],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<{ items: SignalRow[]; nextCursor: string | null }>(
        `/api/signals?accountId=${accountId}&limit=30&sort=${sort}${types.length ? `&types=${types.join(",")}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Type"
          options={SIGNAL_TYPES.map((t) => ({ value: t, label: SIGNAL_TYPE_LABELS[t] }))}
          value={types}
          onChange={setTypes}
        />
        <FilterChip
          label="Sort"
          options={[
            { value: "recent", label: "Most recent" },
            { value: "relevance", label: "Most relevant" },
          ]}
          value={[sort]}
          onChange={(v) => setSort((v.at(-1) as "recent" | "relevance") ?? "recent")}
        />
      </div>
      {q.isLoading ? (
        <CardSkeleton lines={6} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState
          title="No signals"
          description="Signals from public sources will appear here once fetched."
        />
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {items.map((s) => (
            <li key={s.id} className="flex gap-3 px-4 py-3">
              <span
                className="tabular mt-0.5 w-10 shrink-0 text-right text-sm font-semibold"
                title="Relevance"
                data-internal-only="true"
              >
                {Math.round(s.relevance)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium">{s.title}</p>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open source"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                {s.summary && (
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{s.summary}</p>
                )}
                <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                    {SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type}
                  </Badge>
                  {s.practiceTags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="h-4 px-1.5 text-[10px] font-normal"
                    >
                      {practiceLabel(t, true)}
                    </Badge>
                  ))}
                  <span>{s.isDemo ? "Demo data" : s.source}</span>·
                  <span>
                    {formatDistanceToNowStrict(new Date(s.publishedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          disabled={q.isFetchingNextPage}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </section>
  );
}
