"use client";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Multi-select from a suggested list, with free-text additions. */
export function TagPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const all = [...new Set([...options, ...value])];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="hover:bg-muted rounded"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="xs" aria-label={`Add ${label}`}>
            <Plus /> Add
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-1">
          <div className="max-h-56 overflow-auto">
            {all.map((o) => {
              const on = value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
                  className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]"
                >
                  <span className="grid size-4 place-items-center">
                    {on && <Check className="size-3.5" />}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
          <form
            className="flex gap-1 border-t p-1 pt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const v = custom.trim();
              if (v && !value.includes(v)) onChange([...value, v]);
              setCustom("");
            }}
          >
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={`Other ${label.toLowerCase()}…`}
              className="h-7 text-xs"
              aria-label={`Custom ${label}`}
            />
            <Button type="submit" size="sm" className="h-7" disabled={!custom.trim()}>
              Add
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
