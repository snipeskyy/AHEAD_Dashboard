"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api-client";

/** Search-as-you-type account picker (FTS-backed). Results render in a portal so they're never clipped by dialogs. */
export function AccountPicker({
  value,
  onChange,
  id,
  placeholder = "Search accounts…",
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
  id?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const dq = useDebounced(q.trim(), 150);
  const { data } = useQuery({
    queryKey: ["search", "accounts", dq],
    queryFn: () =>
      api<{ hits: Array<{ entityId: string; title: string }> }>(
        `/api/search?q=${encodeURIComponent(dq)}&types=account&limit=8`,
      ),
    enabled: !value && dq.length >= 2,
  });
  if (value)
    return (
      <div className="bg-muted/40 flex h-8 items-center justify-between gap-2 rounded-md border px-2.5 text-sm">
        <span className="truncate">{value.name}</span>
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={() => {
            setQ("");
            onChange(null);
          }}
        >
          Change
        </Button>
      </div>
    );
  const hits = dq.length >= 2 ? (data?.hits ?? []) : [];
  const open = focused && hits.length > 0;
  return (
    <Popover open={open}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ul role="listbox" aria-label="Matching accounts" className="max-h-60 overflow-auto">
          {hits.map((h) => (
            <li key={h.entityId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="hover:bg-muted w-full rounded px-2.5 py-1.5 text-left text-sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ id: h.entityId, name: h.title });
                  setFocused(false);
                }}
              >
                {h.title}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
