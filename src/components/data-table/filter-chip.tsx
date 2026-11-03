"use client";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Multi-select filter chip used in the single filter row above lists. */
export function FilterChip({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const summary =
    value.length === 0
      ? "All"
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1 font-normal",
            value.length > 0 && "border-primary/50 bg-brand-soft",
          )}
        >
          <span className="text-muted-foreground">{label}:</span>{" "}
          <span className="max-w-32 truncate">{summary}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="max-h-72 overflow-auto"
        >
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() =>
                  onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])
                }
                className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]"
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded border",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
