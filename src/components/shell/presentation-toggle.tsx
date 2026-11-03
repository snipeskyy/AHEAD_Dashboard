"use client";
import { Presentation } from "lucide-react";
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
          aria-label="Presentation Mode"
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
