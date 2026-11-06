"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListChecks,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { api } from "@/lib/api-client";

interface Queue {
  paused: boolean;
  counts: { queued: number; running: number; done: number; failed: number; cancelled: number };
  jobs: Array<{
    id: string;
    accountId: string;
    name: string;
    status: string;
    error: string | null;
    attempts: number;
    createdAt: string;
    finishedAt: string | null;
  }>;
}
const ICON: Record<string, typeof Clock> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle2,
  failed: AlertCircle,
  cancelled: XCircle,
};

/** Bulk enrichment progress: pause/resume, cancel, retry failed, per-account error log. Survives restarts (DB queue). */
export function QueueSheet() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["enrichment", "queue"],
    queryFn: () => api<Queue>("/api/enrichment/queue"),
    refetchInterval: (q) =>
      q.state.data && q.state.data.counts.queued + q.state.data.counts.running > 0 ? 2000 : 15_000,
  });
  const act = useMutation({
    mutationFn: (action: string) =>
      api("/api/enrichment/queue", { method: "POST", json: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrichment"] }),
    onError: (e) => toast.error(e.message),
  });
  const c = data?.counts;
  const active = c ? c.queued + c.running : 0;
  const total = c ? active + c.done + c.failed : 0;
  const pct = total ? Math.round(((c!.done + c!.failed) / total) * 100) : 0;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {active ? <Loader2 className="animate-spin" /> : <ListChecks />}
          {active ? `Enriching ${active}` : "Enrichment queue"}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Enrichment queue</SheetTitle>
          <SheetDescription>
            Public sources run in the background worker, a few accounts at a time. Closing the app
            keeps the queue.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6 text-[13px]">
          {c && (
            <>
              <div className="grid gap-1.5" role="status" aria-label="Queue progress">
                <div className="flex justify-between text-xs">
                  <span>{data!.paused ? "Paused" : active ? "Running" : "Idle"}</span>
                  <span className="tabular">
                    {c.done + c.failed} of {total} done · {c.failed} failed
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                  <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {data!.paused ? (
                  <Button size="sm" onClick={() => act.mutate("resume")}>
                    <Play /> Resume
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => act.mutate("pause")}
                    disabled={!active}
                  >
                    <Pause /> Pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act.mutate("cancel")}
                  disabled={!c.queued}
                >
                  <XCircle /> Cancel queued
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act.mutate("retry-failed")}
                  disabled={!c.failed}
                >
                  <RotateCcw /> Retry failed
                </Button>
              </div>
            </>
          )}
          <ul className="divide-y rounded-lg border">
            {(data?.jobs ?? []).map((j) => {
              const Icon = ICON[j.status] ?? Clock;
              return (
                <li key={j.id} className="flex items-start gap-2 px-3 py-2">
                  <Icon
                    className={`mt-0.5 size-3.5 shrink-0 ${j.status === "running" ? "animate-spin" : ""} ${j.status === "failed" ? "text-critical-text" : j.status === "done" ? "text-good-text" : "text-muted-foreground"}`}
                    aria-label={j.status}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/accounts/${j.accountId}?tab=profile`}
                      className="font-medium hover:underline"
                    >
                      {j.name}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {j.status}
                      {j.finishedAt
                        ? ` · ${formatDistanceToNowStrict(new Date(j.finishedAt))} ago`
                        : ""}
                    </div>
                    {j.error && (
                      <p className="text-critical-text mt-0.5 text-xs break-words">{j.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
            {!data?.jobs.length && (
              <li className="text-muted-foreground px-3 py-4 text-center text-xs">
                Nothing queued.
              </li>
            )}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
