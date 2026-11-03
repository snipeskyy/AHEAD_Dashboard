"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Plus, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SavedViews } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useLiveSignals } from "@/components/providers/live-signals";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  CreateOppDialog,
  type CreateOppDefaults,
} from "@/modules/opportunities/components/create-opp-dialog";
import { useUiStore } from "@/stores/ui-store";
import { ConvertToPlayDialog, ConvertToTouchDialog } from "../components/convert-dialogs";
import { DigestView } from "../components/digest-view";
import { ManualSignalDialog } from "../components/manual-signal-dialog";
import { SignalDetailSheet } from "../components/signal-detail-sheet";
import { SignalFeed } from "../components/signal-feed";
import { SignalFilterBar } from "../components/signal-filters";
import type { SignalAction } from "../components/signal-row";
import {
  DEFAULT_SIGNAL_FILTERS,
  useSignalPatch,
  type SignalFilters,
  type SignalRow,
} from "../hooks/use-signals";

const BUILT_IN: Array<{ name: string; config: SignalFilters }> = [
  {
    name: "Hot this week",
    config: { ...DEFAULT_SIGNAL_FILTERS, sinceDays: 7, minRelevance: 60, sort: "relevance" },
  },
  {
    name: "Strategic accounts",
    config: { ...DEFAULT_SIGNAL_FILTERS, tiers: ["Strategic"], sinceDays: 7 },
  },
  { name: "AI infrastructure", config: { ...DEFAULT_SIGNAL_FILTERS, practices: ["ai-infra"] } },
  {
    name: "Exec changes & M&A",
    config: { ...DEFAULT_SIGNAL_FILTERS, types: ["exec-change", "m-and-a"] },
  },
  { name: "Starred", config: { ...DEFAULT_SIGNAL_FILTERS, starred: true, sinceDays: null } },
];

export default function SignalsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const live = useLiveSignals();
  const tab = params.get("tab") === "digest" ? "digest" : "feed";
  const focus = params.get("focus");
  const setParam = useCallback(
    (k: string, v: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (v === null) next.delete(k);
      else next.set(k, v);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const [filters, setFilters] = useState<SignalFilters>(DEFAULT_SIGNAL_FILTERS);
  const [visible, setVisible] = useState<SignalRow[]>([]);
  const [manual, setManual] = useState(false);
  const [playFor, setPlayFor] = useState<SignalRow | null>(null);
  const [touchFor, setTouchFor] = useState<SignalRow | null>(null);
  const [oppFor, setOppFor] = useState<CreateOppDefaults | null>(null);
  const patch = useSignalPatch();
  const openNote = useUiStore((s) => s.openNoteDialog);

  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: () => api<{ fetching: boolean }>("/api/sources"),
    refetchInterval: (q) => (q.state.data?.fetching ? 3000 : false),
  });
  const fetchNow = useMutation({
    mutationFn: () => api("/api/sources/fetch", { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Fetching public sources — new signals will stream in");
      qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });
  const markAllRead = useMutation({
    mutationFn: () =>
      api("/api/signals/bulk", {
        method: "POST",
        json: {
          ids: visible
            .filter((s) => !s.read)
            .map((s) => s.id)
            .slice(0, 500),
          patch: { read: true },
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signals"] }),
  });

  const onAction = useCallback(
    (a: SignalAction, s: SignalRow) => {
      switch (a) {
        case "open":
          setParam("focus", s.id);
          if (!s.read) patch.mutate({ id: s.id, patch: { read: true } });
          return;
        case "star":
          return patch.mutate({ id: s.id, patch: { starred: !s.starred } });
        case "read":
          return patch.mutate({ id: s.id, patch: { read: !s.read } });
        case "dismiss":
          return patch.mutate(
            { id: s.id, patch: { dismissed: !s.dismissed } },
            {
              onSuccess: () =>
                !s.dismissed &&
                toast("Signal dismissed", {
                  action: {
                    label: "Undo",
                    onClick: () => patch.mutate({ id: s.id, patch: { dismissed: false } }),
                  },
                }),
            },
          );
        case "summary":
          return patch.mutate(
            { id: s.id, patch: { inNextSummary: !s.inNextSummary } },
            {
              onSuccess: () =>
                toast.success(
                  s.inNextSummary ? "Removed from next summary" : "Added to next executive summary",
                ),
            },
          );
        case "note":
          return openNote("signal", s.id);
        case "play":
          return setPlayFor(s);
        case "touch":
          return setTouchFor(s);
        case "opportunity":
          return setOppFor({
            account: { id: s.accountId, name: s.accountName },
            practiceArea: s.practiceTags[0],
            name: `${s.accountName.split(" ")[0]} — ${s.title.slice(0, 60)}`,
            sourceSignalId: s.id,
            nextStep: `Follow up on: ${s.title.slice(0, 120)}`,
          });
      }
    },
    [patch, openNote, setParam],
  );

  return (
    <PageContainer>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Live Signals
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                live.status === "live" ? "text-good-text" : "text-muted-foreground",
              )}
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  live.status === "live" ? "bg-good animate-pulse" : "bg-warning",
                )}
                aria-hidden
              />
              {live.status === "live"
                ? "Live"
                : live.status === "connecting"
                  ? "Connecting"
                  : "Reconnecting"}
            </span>
          </span>
        }
        description="Public signals across every account, auto-tagged to practice areas and scored for relevance. Hover a score to see why."
        actions={
          <>
            <SavedViews<SignalFilters>
              scope="signals"
              current={filters}
              builtIn={BUILT_IN}
              onApply={(c) => setFilters({ ...DEFAULT_SIGNAL_FILTERS, ...c })}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => markAllRead.mutate()}
              disabled={!visible.some((s) => !s.read)}
            >
              <CheckCheck /> Mark visible read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => fetchNow.mutate()}
              disabled={fetchNow.isPending || sources?.fetching}
            >
              <RefreshCw className={cn(sources?.fetching && "animate-spin")} />{" "}
              {sources?.fetching ? "Fetching…" : "Fetch now"}
            </Button>
            <Button size="sm" className="h-8" onClick={() => setManual(true)}>
              <Plus /> Add signal
            </Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParam("tab", v === "feed" ? null : v)}>
        <TabsList>
          <TabsTrigger
            aria-controls={undefined /* URL-driven tabs: the panel is rendered outside <Tabs> */}
            value="feed"
          >
            Feed
          </TabsTrigger>
          <TabsTrigger
            aria-controls={undefined /* URL-driven tabs: the panel is rendered outside <Tabs> */}
            value="digest"
          >
            Digest
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "feed" ? (
        <>
          <SignalFilterBar value={filters} onChange={setFilters} />
          <SignalFeed
            filters={filters}
            onAction={onAction}
            focusId={focus}
            onVisibleChange={setVisible}
          />
        </>
      ) : (
        <DigestView onAction={onAction} />
      )}
      <SignalDetailSheet id={focus} onClose={() => setParam("focus", null)} onAction={onAction} />
      <ManualSignalDialog open={manual} onOpenChange={setManual} />
      <ConvertToPlayDialog signal={playFor} onClose={() => setPlayFor(null)} />
      <ConvertToTouchDialog signal={touchFor} onClose={() => setTouchFor(null)} />
      <CreateOppDialog
        open={!!oppFor}
        onOpenChange={(o) => !o && setOppFor(null)}
        defaults={oppFor ?? undefined}
        onCreated={(id) => router.push(`/opportunities?focus=${id}`)}
      />
    </PageContainer>
  );
}
