"use client";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight inline editors for dense tables. They commit on Enter/blur and cancel on Escape,
 * and stop click propagation so row-click handlers don't fire.
 */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const base =
  "h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-[13px] outline-none hover:border-input focus:border-ring focus:bg-background";

export function InlineText({
  value,
  onCommit,
  label,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      className={cn(base, className)}
      value={draft ?? value}
      placeholder={placeholder}
      onClick={stop}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function InlineNumber({
  value,
  onCommit,
  label,
  min = 0,
  max,
  step = 1,
  format,
  className,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) {
      const n = Number(draft.replace(/[$,\s]/g, ""));
      if (Number.isFinite(n) && n >= min && (max === undefined || n <= max) && n !== value)
        onCommit(n);
    }
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className={cn(base, "tabular min-w-24 text-right", className)}
      value={draft ?? (format ? format(value) : String(value))}
      onFocus={() => setDraft(String(value))}
      onClick={stop}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      step={step}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function InlineDate({
  value,
  onCommit,
  label,
}: {
  value: string;
  onCommit: (iso: string) => void;
  label: string;
}) {
  const day = value.slice(0, 10);
  return (
    <input
      type="date"
      aria-label={label}
      className={cn(base, "tabular w-[8.5rem]")}
      defaultValue={day}
      key={day}
      onClick={stop}
      onKeyDown={stop}
      onBlur={(e) => {
        if (e.target.value && e.target.value !== day)
          onCommit(new Date(`${e.target.value}T12:00:00Z`).toISOString());
      }}
    />
  );
}

export function InlineSelect({
  value,
  options,
  onCommit,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (v: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className={cn(base, "min-w-32 cursor-pointer pr-6")}
      value={value}
      onClick={stop}
      onKeyDown={stop}
      onChange={(e) => onCommit(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
