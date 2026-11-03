"use client";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { DEAL_RISK_LABELS, type DealRiskFlag } from "@/lib/scoring/deal-risk";
import { cn } from "@/lib/utils";

export function StageBadge({ stage }: { stage: Stage }) {
  const cls =
    stage === "ClosedWon"
      ? "border-good/40 text-good-text"
      : stage === "ClosedLost"
        ? "text-muted-foreground"
        : "";
  return (
    <Badge variant="outline" className={cn("font-normal", cls)}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}

/** Risk indicator: icon + count + tooltip with labels (never color alone). */
export function RiskBadge({
  flags,
  compact = false,
}: {
  flags: DealRiskFlag[];
  compact?: boolean;
}) {
  if (!flags.length)
    return compact ? null : <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-internal-only="true"
          className="bg-critical/10 text-critical-text inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
          aria-label={`Risk: ${flags.map((f) => DEAL_RISK_LABELS[f]).join(", ")}`}
        >
          <AlertTriangle className="size-3" aria-hidden />
          {compact ? flags.length : `${flags.length} risk${flags.length > 1 ? "s" : ""}`}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="grid gap-0.5">
          {flags.map((f) => (
            <li key={f}>{DEAL_RISK_LABELS[f]}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/** MEDDPICC completeness meter (status-colored with text value). */
export function MeddpiccMeter({ score }: { score: number }) {
  const color = score >= 70 ? "bg-good" : score >= 50 ? "bg-warning" : "bg-critical";
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`MEDDPICC ${score}%`}>
      <span className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </span>
      <span className="text-muted-foreground tabular text-xs">{score}%</span>
    </span>
  );
}
