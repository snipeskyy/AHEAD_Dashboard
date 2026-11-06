"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface Row { id: string; action: string; actorName: string; summary: string; entityType: string | null; createdAt: string }
const FILTERS = [["", "All"], ["import", "Imports"], ["enrichment", "Enrichment"], ["export", "Exports"], ["pack", "Packs"], ["plays", "Plays"], ["delete", "Deletes"]] as const;
const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm";

/** Append-only record of imports, enrichment decisions, exports, packs and deletes. */
export function AuditLog() {
  const [action, setAction] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["audit", action],
    queryFn: ({ pageParam }) => api<{ items: Row[]; nextCursor: string | null }>(`/api/audit?limit=50${action ? `&action=${action}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (p) => p.nextCursor,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="grid gap-3" aria-label="Audit log">
      <div className="flex items-center gap-2 text-[13px]">
        <label htmlFor="au-f">Show</label>
        <select id="au-f" className={sel} value={action} onChange={(e) => setAction(e.target.value)}>{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <div className="bg-card overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Audit entries">
        <table className="w-full text-[13px]">
          <thead className="text-muted-foreground border-b text-left text-xs"><tr><th className="px-4 py-2 font-medium">When</th><th className="px-2 font-medium">Who</th><th className="px-2 font-medium">Action</th><th className="px-2 font-medium">What</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="tabular text-muted-foreground px-4 py-1.5 text-xs whitespace-nowrap">{format(new Date(r.createdAt), "MMM d, HH:mm")}</td>
                <td className="px-2 text-xs whitespace-nowrap">{r.actorName}</td>
                <td className="px-2"><code className="text-xs">{r.action}</code></td>
                <td className="px-2">{r.summary}</td>
              </tr>
            ))}
            {!rows.length && !q.isLoading && <tr><td colSpan={4} className="text-muted-foreground px-4 py-6 text-center text-xs">Nothing recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {q.hasNextPage && <Button variant="outline" size="sm" className="w-fit" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</Button>}
    </section>
  );
}
