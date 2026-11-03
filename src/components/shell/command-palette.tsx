"use client";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, KanbanSquare, Lightbulb, Radio, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDebounced } from "@/hooks/use-debounced";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { api } from "@/lib/api-client";
import type { SearchEntityType } from "@/lib/search/types";
import { registry } from "@/modules/registry";
import { useUiStore } from "@/stores/ui-store";
import { useRunCommand } from "./command-actions";

interface Hit {
  entityType: SearchEntityType;
  entityId: string;
  accountId: string | null;
  accountName: string | null;
  title: string;
  snippet: string;
}

const HIT_META: Record<
  SearchEntityType,
  { label: string; icon: LucideIcon; href: (h: Hit) => string }
> = {
  account: { label: "Accounts", icon: Building2, href: (h) => `/accounts/${h.entityId}` },
  opportunity: {
    label: "Opportunities",
    icon: KanbanSquare,
    href: (h) => `/opportunities?focus=${h.entityId}`,
  },
  signal: { label: "Signals", icon: Radio, href: (h) => `/signals?focus=${h.entityId}` },
  note: {
    label: "Notes",
    icon: FileText,
    href: (h) => (h.accountId ? `/accounts/${h.accountId}?tab=notes` : "/accounts"),
  },
  play: { label: "Plays", icon: Lightbulb, href: () => `/demand-gen?tab=plays` },
};
const HIT_ORDER: SearchEntityType[] = ["account", "opportunity", "signal", "note", "play"];

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();
  const run = useRunCommand();
  const flags = useFeatureFlags();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 150);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => api<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(q)}&limit=25`),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  });

  const commands = useMemo(() => registry.commands(flags), [flags]);
  const lower = query.toLowerCase();
  const matching = commands.filter(
    (c) => !lower || [c.label, ...(c.keywords ?? [])].some((s) => s.toLowerCase().includes(lower)),
  );
  const groups = ["Navigate", "Create", "Actions"] as const;

  const select = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    fn();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        className="top-[18%] translate-y-0 gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search accounts, opportunities, signals, notes and plays, or run a command.
        </DialogDescription>
        <Command shouldFilter={false} className="rounded-none">
          <CommandInput
            placeholder="Jump to an account, search signals, or run a command…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>{isFetching ? "Searching…" : "No results."}</CommandEmpty>
            {q.length >= 2 &&
              HIT_ORDER.map((type) => {
                const hits = data?.hits.filter((h) => h.entityType === type) ?? [];
                if (!hits.length) return null;
                const meta = HIT_META[type];
                const Icon = meta.icon;
                return (
                  <CommandGroup key={type} heading={meta.label}>
                    {hits.slice(0, 6).map((h) => (
                      <CommandItem
                        key={`${type}-${h.entityId}`}
                        value={`${type}-${h.entityId}`}
                        onSelect={() => select(() => router.push(meta.href(h)))}
                      >
                        <Icon className="text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{h.title}</span>
                          {h.accountName && type !== "account" && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {h.accountName}
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            {groups.map((g) => {
              const items = matching.filter((c) => c.group === g);
              if (!items.length) return null;
              return (
                <CommandGroup key={g} heading={g}>
                  {items.map((c) => (
                    <CommandItem key={c.id} value={c.id} onSelect={() => select(() => run(c))}>
                      {c.label}
                      {c.shortcut && <CommandShortcut>{c.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
