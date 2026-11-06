"use client";
import { Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui-store";

export function PresentationToggle() {
  const on = useUiStore((s) => s.presentationMode);
  const set = useUiStore((s) => s.setPresentationMode);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={on}
          onPressedChange={set}
          aria-label={`${on ? "Presenting" : "Present"} (Presentation Mode)`}
          className="data-[state=on]:bg-brand-soft data-[state=on]:text-primary h-7 gap-1.5 px-2 text-xs"
        >
          <Presentation className="size-3.5" />
          <span className="hidden lg:inline">{on ? "Presenting" : "Present"}</span>
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Presentation Mode hides internal-only data for screen-sharing</TooltipContent>
    </Tooltip>
  );
}

/** Slim banner while presenting: reminds the presenter what is hidden and offers a one-click exit. */
export function PresentationBanner() {
  const on = useUiStore((s) => s.presentationMode);
  const set = useUiStore((s) => s.setPresentationMode);
  if (!on) return null;
  return (
    <div
      role="status"
      className="bg-brand-soft text-primary flex items-center justify-center gap-3 border-b px-4 py-1.5 text-xs"
      data-print-hide="true"
    >
      <Presentation className="size-3.5" aria-hidden />
      <span>Presentation Mode — internal-only data is hidden</span>
      <Button variant="outline" size="xs" className="h-6" onClick={() => set(false)}>
        <X /> Exit
      </Button>
    </div>
  );
}
