"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PART_LABELS: Record<string, string> = {
  recency: "Recency",
  sourceWeight: "Source weight",
  practiceMatch: "Practice match",
  tierFactor: "Account tier",
};

/** Relevance score with its multiplicative breakdown on hover/focus (spec 5.3). */
export function RelevanceBadge({
  value,
  parts,
  className,
}: {
  value: number;
  parts: Record<string, number>;
  className?: string;
}) {
  const v = Math.round(value);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-internal-only="true"
          aria-label={`Relevance ${v}. Show breakdown`}
          className={cn(
            "tabular grid h-8 w-10 shrink-0 place-items-center rounded-md border text-sm font-semibold",
            v >= 75
              ? "border-primary/40 bg-brand-soft text-primary"
              : v >= 50
                ? "bg-muted"
                : "text-muted-foreground",
            className,
          )}
        >
          {v}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="w-60">
        <div className="mb-1 font-medium">Relevance {v} / 100</div>
        <table className="w-full text-xs">
          <tbody>
            {["recency", "sourceWeight", "practiceMatch", "tierFactor"].map((k) => (
              <tr key={k}>
                <td className="py-0.5 opacity-80">{PART_LABELS[k]}</td>
                <td className="tabular py-0.5 text-right">× {(parts[k] ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 text-[11px] opacity-70">100 × recency × source × practice × tier</div>
      </TooltipContent>
    </Tooltip>
  );
}
