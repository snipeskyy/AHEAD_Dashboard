"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

interface SavedView<C> {
  id: string;
  name: string;
  config: C;
}

/** Save / apply / delete named views (filters, sorting, columns) for a list scope. */
export function SavedViews<C extends object>({
  scope,
  current,
  onApply,
  builtIn = [],
}: {
  scope: string;
  current: C;
  onApply: (c: C, name: string) => void;
  builtIn?: Array<{ name: string; config: C }>;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["saved-views", scope],
    queryFn: () => api<{ items: Array<SavedView<C>> }>(`/api/saved-views?scope=${scope}`),
  });
  const save = useMutation({
    mutationFn: () =>
      api("/api/saved-views", {
        method: "POST",
        json: { scope, name: name.trim(), config: current },
      }),
    onSuccess: () => {
      toast.success(`Saved view "${name.trim()}"`);
      setActive(name.trim());
      setName("");
      qc.invalidateQueries({ queryKey: ["saved-views", scope] });
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/saved-views/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views", scope] }),
  });
  const views = [
    ...builtIn.map((b) => ({ id: `builtin:${b.name}`, ...b })),
    ...(data?.items ?? []),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Bookmark /> {active ?? "Views"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        {views.length === 0 && (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">No saved views yet.</div>
        )}
        {views.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onSelect={() => {
              setActive(v.name);
              onApply(v.config, v.name);
            }}
            className="group"
          >
            {active === v.name ? <Check /> : <span className="size-4" />}
            <span className="flex-1 truncate">{v.name}</span>
            {!v.id.startsWith("builtin:") && (
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  remove.mutate(v.id);
                }}
              >
                <Trash2 className="text-muted-foreground size-3.5" />
              </button>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form
          className="flex gap-1.5 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save.mutate();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save current as…"
            className="h-7 text-xs"
            aria-label="View name"
          />
          <Button type="submit" size="sm" className="h-7" disabled={!name.trim() || save.isPending}>
            Save
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
