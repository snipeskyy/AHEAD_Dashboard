"use client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { SignalRow } from "@/lib/server/signals";
import type { TagHit } from "@/lib/tagging/rules";
import type { ScoreBreakdown } from "@/lib/scoring/types";

export type { SignalRow };

export interface SignalFilters {
  q: string;
  accountId: string | null;
  accountName: string | null;
  types: string[];
  practices: string[];
  sources: string[];
  tiers: string[];
  sinceDays: number | null;
  minRelevance: number;
  unread: boolean;
  starred: boolean;
  inNextSummary: boolean;
  includeDismissed: boolean;
  sort: "recent" | "relevance";
}

export const DEFAULT_SIGNAL_FILTERS: SignalFilters = {
  q: "",
  accountId: null,
  accountName: null,
  types: [],
  practices: [],
  sources: [],
  tiers: [],
  sinceDays: 30,
  minRelevance: 0,
  unread: false,
  starred: false,
  inNextSummary: false,
  includeDismissed: false,
  sort: "recent",
};

export function filtersToQuery(f: SignalFilters): string {
  const p = new URLSearchParams({ sort: f.sort, limit: "40" });
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.accountId) p.set("accountId", f.accountId);
  if (f.types.length) p.set("types", f.types.join(","));
  if (f.practices.length) p.set("practices", f.practices.join(","));
  if (f.sources.length) p.set("sources", f.sources.join(","));
  if (f.tiers.length) p.set("tiers", f.tiers.join(","));
  if (f.sinceDays !== null) p.set("sinceDays", String(f.sinceDays));
  if (f.minRelevance) p.set("minRelevance", String(f.minRelevance));
  if (f.unread) p.set("unread", "true");
  if (f.starred) p.set("starred", "true");
  if (f.inNextSummary) p.set("inNextSummary", "true");
  if (f.includeDismissed) p.set("includeDismissed", "true");
  return p.toString();
}

/** Client-side predicate mirroring the server filter, used to decide if a live signal belongs in the current view. */
export function matchesFilters(s: SignalRow, f: SignalFilters): boolean {
  const q = f.q.trim().toLowerCase();
  return (
    (!q || s.title.toLowerCase().includes(q) || (s.summary ?? "").toLowerCase().includes(q)) &&
    (!f.accountId || s.accountId === f.accountId) &&
    (!f.types.length || f.types.includes(s.type)) &&
    (!f.practices.length || s.practiceTags.some((t) => f.practices.includes(t))) &&
    (!f.sources.length || f.sources.includes(s.source)) &&
    (!f.tiers.length || f.tiers.includes(s.accountTier)) &&
    s.relevance >= f.minRelevance &&
    (!f.starred || s.starred) &&
    (!f.inNextSummary || s.inNextSummary)
  );
}

type Page = { items: SignalRow[]; nextCursor: string | null };

export function useSignalFeed(f: SignalFilters) {
  const qs = filtersToQuery(f);
  return useInfiniteQuery({
    queryKey: ["signals", "feed", qs],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<Page>(`/api/signals?${qs}${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export interface SignalDetail extends SignalRow {
  tagHits: TagHit[];
  relevanceBreakdown: ScoreBreakdown & { parts: Record<string, number> };
  notes: Array<{ id: string; body: string; createdAt: string }>;
  convertedTouches: number;
  convertedOpps: Array<{ id: string; name: string }>;
}

export const useSignal = (id: string | null) =>
  useQuery({
    queryKey: ["signal", id],
    queryFn: () => api<SignalDetail>(`/api/signals/${id}`),
    enabled: !!id,
  });

/** Patch flags with optimistic update across all cached feed pages. */
export function useSignalPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<SignalRow, "read" | "starred" | "dismissed" | "inNextSummary">>;
    }) => api<SignalRow>(`/api/signals/${id}`, { method: "PATCH", json: patch }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["signals", "feed"] });
      const snaps = qc.getQueriesData<InfiniteData<Page>>({ queryKey: ["signals", "feed"] });
      for (const [key, data] of snaps) {
        if (!data) continue;
        qc.setQueryData<InfiniteData<Page>>(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          })),
        });
      }
      return { snaps };
    },
    onError: (e, _v, ctx) => {
      ctx?.snaps.forEach(([k, d]) => qc.setQueryData(k, d));
      toast.error(e.message);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ["signal", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSignalConvert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api<{ kind: string; id: string; touches?: number }>(`/api/signals/${id}/convert`, {
        method: "POST",
        json: body,
      }),
    onSuccess: (r, { id }) => {
      toast.success(
        r.kind === "campaign" ? `Play launched with ${r.touches} planned touches` : "Touch planned",
      );
      qc.invalidateQueries({ queryKey: ["signal", id] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["touches"] });
    },
    onError: (e) => toast.error(e.message),
  });
}
