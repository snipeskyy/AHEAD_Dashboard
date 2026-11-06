"use client";
import { AlertCircle, CheckCircle2, Circle, Clock, Eye, Loader2, RefreshCw } from "lucide-react";
import { STATUS_LABEL, type EnrichStatus } from "@/lib/enrich/status";
import { cn } from "@/lib/utils";

const META: Record<EnrichStatus, { icon: typeof Circle; cls: string }> = {
  "not-enriched": { icon: Circle, cls: "text-muted-foreground" },
  queued: { icon: Clock, cls: "text-muted-foreground" },
  running: { icon: Loader2, cls: "text-primary" },
  review: { icon: Eye, cls: "text-warning-text" },
  "up-to-date": { icon: CheckCircle2, cls: "text-good-text" },
  stale: { icon: RefreshCw, cls: "text-warning-text" },
  failed: { icon: AlertCircle, cls: "text-critical-text" },
};

/** Status always shows an icon AND a label (never color alone). */
export function EnrichStatusBadge({
  status,
  pending,
  className,
}: {
  status: EnrichStatus;
  pending?: number;
  className?: string;
}) {
  const m = META[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", m.cls, className)}
    >
      <m.icon
        className={cn("size-3.5 shrink-0", status === "running" && "animate-spin")}
        aria-hidden
      />
      {STATUS_LABEL[status]}
      {status === "review" && pending ? ` (${pending})` : ""}
    </span>
  );
}

/** Completeness meter: bar + percentage (text carries the value). */
export function CompletenessMeter({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`${pct}% complete`}>
      <span className="bg-muted relative h-1.5 w-16 overflow-hidden rounded-full" aria-hidden>
        <span
          className="bg-primary absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular text-xs">{pct}%</span>
    </span>
  );
}
