"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api-client";

/** Search-as-you-type account picker (FTS-backed). */
export function AccountPicker({
  value,
  onChange,
  id,
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
  id?: string;
}) {
  const [q, setQ] = useState("");
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
      <div className="bg-muted/40 flex h-8 items-center justify-between rounded-md border px-2.5 text-sm">
        <span className="truncate">{value.name}</span>
        <Button type="button" variant="link" size="xs" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  return (
    <div className="relative">
      <Input
        id={id}
        placeholder="Search accounts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {!!data?.hits.length && (
        <ul
          role="listbox"
          className="bg-popover absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-md"
        >
          {data.hits.map((h) => (
            <li key={h.entityId}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="hover:bg-muted w-full px-2.5 py-1.5 text-left text-sm"
                onClick={() => onChange({ id: h.entityId, name: h.title })}
              >
                {h.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
