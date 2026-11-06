"use client";
import { format } from "date-fns";
import { BadgeCheck, ExternalLink, Lock, PenLine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CONF_LABEL: Record<string, string> = {
  user: "Entered by you",
  verified: "Verified by you",
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/** Small provenance chip: hover/focus shows source, date, confidence and the public link. */
export function SourceIndicator({
  source,
  sourceUrl,
  confidence,
  fetchedAt,
  locked,
}: {
  source: string;
  sourceUrl: string | null;
  confidence: string;
  fetchedAt?: string | null;
  locked?: boolean;
}) {
  const user = source === "user";
  const Icon = user ? PenLine : confidence === "verified" ? BadgeCheck : ExternalLink;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 rounded px-1 text-[10px] uppercase outline-none focus-visible:ring-2"
          aria-label={`Source: ${user ? "you" : source}. ${CONF_LABEL[confidence] ?? confidence}${locked ? ". Locked" : ""}`}
        >
          <Icon className="size-3" aria-hidden />
          {user ? "You" : source.replace(/^sec-/, "SEC ").slice(0, 14)}
          {locked && <Lock className="size-2.5" aria-hidden />}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-xs">
        <div className="font-medium">{user ? "Entered by you" : source}</div>
        <div>
          {CONF_LABEL[confidence] ?? confidence}
          {fetchedAt ? ` · fetched ${format(new Date(fetchedAt), "MMM d, yyyy")}` : ""}
        </div>
        {locked && <div>Locked: enrichment won&apos;t overwrite it.</div>}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open source
          </a>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export const ConfidenceBadge = ({ c }: { c: string }) => (
  <span
    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${c === "high" ? "bg-good/15 text-good-text" : c === "medium" ? "bg-warning/15 text-warning-text" : "bg-muted text-muted-foreground"}`}
  >
    {c}
  </span>
);
