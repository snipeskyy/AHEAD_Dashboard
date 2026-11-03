"use client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp, Inbox } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveSignals } from "@/components/providers/live-signals";
import {
  matchesFilters,
  useSignalFeed,
  type SignalFilters,
  type SignalRow,
} from "../hooks/use-signals";
import { SignalRowView, type SignalAction } from "./signal-row";

/** Virtualized infinite feed. New live signals that match the filters queue behind a banner (no layout jumps). */
export function SignalFeed({
  filters,
  onAction,
  focusId,
  onVisibleChange,
}: {
  filters: SignalFilters;
  onAction: (a: SignalAction, s: SignalRow) => void;
  focusId: string | null;
  onVisibleChange?: (rows: SignalRow[]) => void;
}) {
  const q = useSignalFeed(filters);
  const live = useLiveSignals();
  const [pending, setPending] = useState<SignalRow[]>([]);
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(
    () =>
      live.subscribe(
        (s) =>
          matchesFilters(s, filtersRef.current) &&
          setPending((p) => (p.some((x) => x.id === s.id) ? p : [s, ...p])),
      ),
    [live],
  );

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  useEffect(() => onVisibleChange?.(rows), [rows, onVisibleChange]);
  const parentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns non-memoizable functions; used as documented
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });
  const items = v.getVirtualItems();
  const last = items.at(-1);
  useEffect(() => {
    if (last && last.index >= rows.length - 5 && q.hasNextPage && !q.isFetchingNextPage)
      q.fetchNextPage();
  }, [last, rows.length, q]);

  const showPending = () => {
    setPending([]);
    q.refetch();
    parentRef.current?.scrollTo({ top: 0 });
  };

  if (q.isLoading)
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="relative">
      {pending.length > 0 && (
        <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
          <Button size="sm" className="rounded-full shadow-md" onClick={showPending}>
            <ArrowUp /> {pending.length} new signal{pending.length > 1 ? "s" : ""}
          </Button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No signals match"
          description="Widen the date range or clear filters. New public signals arrive automatically."
        />
      ) : (
        <div
          ref={parentRef}
          role="feed"
          aria-busy={q.isFetching}
          aria-label="Signal feed"
          className="bg-card overflow-auto rounded-lg border"
          style={{ height: "calc(100svh - 300px)", minHeight: 420 }}
        >
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {items.map((vi) => (
              <div
                key={rows[vi.index].id}
                data-index={vi.index}
                ref={v.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <SignalRowView
                  s={rows[vi.index]}
                  onAction={onAction}
                  active={rows[vi.index].id === focusId}
                />
              </div>
            ))}
          </div>
          {q.isFetchingNextPage && (
            <p className="text-muted-foreground py-3 text-center text-xs">Loading more…</p>
          )}
        </div>
      )}
    </div>
  );
}
