"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Inbox, Keyboard, PartyPopper } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardSkeleton, EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { practiceLabel } from "@/config/practice-areas";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import type { SignalRow } from "../hooks/use-signals";
import type { SignalAction } from "./signal-row";

interface Queue {
  items: SignalRow[];
  remaining: number;
  triagedToday: number;
  week: Record<string, number>;
}
type TriageAction = "read" | "starred" | "dismissed" | "play" | "opportunity" | "note" | "task";
const KEYS: Record<string, TriageAction> = { s: "starred", d: "dismissed", p: "play", o: "opportunity", n: "note", t: "task", e: "read" };
const WEEK_LABEL: Record<string, string> = { read: "handled", starred: "starred", dismissed: "dismissed", play: "→ play", opportunity: "→ opportunity", note: "→ note", task: "→ task" };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Inbox-style triage: J/K to move, one key per decision, inbox-zero counter, weekly summary. */
export function TriageQueue({ onAction }: { onAction: (a: SignalAction, s: SignalRow) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["signals", "triage"], queryFn: () => api<Queue>("/api/signals/triage") });
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const items = (data?.items ?? []).filter((s) => !done.has(s.id));
  const cur = items[Math.min(idx, items.length - 1)];
  const listRef = useRef<HTMLUListElement>(null);
  const setTriageActive = useUiStore((s) => s.setTriageActive);
  const openTask = useUiStore((s) => s.openTaskDialog);

  const mark = useMutation({
    mutationFn: ({ s, action }: { s: SignalRow; action: TriageAction }) => api(`/api/signals/${s.id}/triage`, { method: "POST", json: { action } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["signals", "feed"] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
    },
  });

  const act = (action: TriageAction, s = cur) => {
    if (!s) return;
    setDone((d) => new Set(d).add(s.id));
    mark.mutate({ s, action });
    if (action === "play") onAction("play", s);
    if (action === "opportunity") onAction("opportunity", s);
    if (action === "note") onAction("note", s);
    if (action === "task")
      openTask({ title: `Follow up: ${s.title.slice(0, 120)}`, account: { id: s.accountId, name: s.accountName }, signalId: s.id, source: "signal" });
  };

  useEffect(() => {
    setTriageActive(true);
    return () => setTriageActive(false);
  }, [setTriageActive]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || ui.commandOpen || ui.taskDialog.open || ui.noteDialog.open || ui.captureOpen || ui.helpOpen) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowdown") setIdx((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
      else if (k === "k" || k === "arrowup") setIdx((i) => Math.max(0, i - 1));
      else if (k === "enter" && cur) onAction("open", cur);
      else if (KEYS[k] && cur) act(KEYS[k]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    listRef.current?.querySelector("[aria-current=true]")?.scrollIntoView({ block: "nearest" });
  }, [idx, items.length]);

  if (isLoading || !data) return <CardSkeleton lines={8} />;
  const remaining = Math.max(0, data.remaining - done.size);
  const week = Object.entries(data.week);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <section aria-label="Triage queue" className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-medium" role="status" aria-live="polite">
            <Inbox className="size-4" aria-hidden /> {remaining} to triage
            <span className="text-muted-foreground font-normal">· {data.triagedToday + done.size} handled today</span>
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Keyboard className="size-3.5" aria-hidden /> J/K move · S star · D dismiss · P play · O opp · N note · T task · E handled · Enter open
          </span>
        </div>
        {!items.length ? (
          <EmptyState icon={PartyPopper} title="Inbox zero" description="Every recent signal has been triaged. New ones appear here as public sources report them." />
        ) : (
          <ul ref={listRef} className="bg-card divide-y rounded-lg border" aria-label="Signals to triage" tabIndex={0}>
            {items.map((s, i) => {
              const active = s.id === cur?.id;
              return (
                <li key={s.id} id={`tri-${s.id}`} aria-current={active ? "true" : undefined} onClick={() => setIdx(i)}
                  className={cn("grid cursor-pointer gap-1 px-4 py-2.5 text-[13px]", active && "bg-brand-soft ring-primary/40 ring-1 ring-inset")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{s.title}</span>
                    <span className="tabular text-muted-foreground shrink-0 text-xs" data-internal-only="true" data-field="signal.relevance">{Math.round(s.relevance)}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {s.accountName} · {s.type.replace(/-/g, " ")} · {formatDistanceToNowStrict(new Date(s.publishedAt))} ago
                    {s.practiceTags.length ? ` · ${s.practiceTags.map((t) => practiceLabel(t, true)).join(", ")}` : ""}
                  </div>
                  {active && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(["starred", "dismissed", "play", "opportunity", "note", "task", "read"] as const).map((a) => (
                        <Button key={a} size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); act(a, s); }}>
                          {{ starred: "Star (S)", dismissed: "Dismiss (D)", play: "Play (P)", opportunity: "Opp (O)", note: "Note (N)", task: "Task (T)", read: "Handled (E)" }[a]}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <aside className="bg-card h-fit rounded-lg border p-4 text-[13px]" aria-labelledby="tri-week">
        <h2 id="tri-week" className="text-sm font-semibold">Triaged this week</h2>
        {week.length ? (
          <ul className="mt-2 grid gap-1">
            {week.sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <li key={k} className="flex justify-between"><span className="text-muted-foreground">{WEEK_LABEL[k] ?? k}</span><span className="tabular font-medium">{n}</span></li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground mt-2 text-xs">Nothing triaged yet this week.</p>}
      </aside>
    </div>
  );
}
