"use client";
import { FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMeta } from "@/hooks/use-meta";

/** Visible whenever synthetic demo data is present in the workspace. */
export function DemoBadge() {
  const { data } = useMeta();
  if (!data?.demo) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          className="border-warning/70 bg-warning/10 text-warning-text inline-flex h-6 items-center gap-1.5 rounded-md border border-dashed px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase"
        >
          <FlaskConical className="size-3.5" aria-hidden />
          Demo<span className="hidden sm:inline"> data</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {data.counts.demoAccounts} fictional demo accounts are loaded. Company names and signals are
        synthetic. Reset or remove them in Settings → Data.
      </TooltipContent>
    </Tooltip>
  );
}
