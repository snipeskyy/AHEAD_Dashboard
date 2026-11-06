"use client";
import { useQuery } from "@tanstack/react-query";
import { ListFilter } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Smart lists the user pinned, shown as a sidebar group. Hidden when collapsed or none are pinned. */
export function PinnedLists({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: ["smart-lists"],
    queryFn: () => api<{ items: Array<{ id: string; name: string; pinned: boolean }> }>("/api/smart-lists").then((r) => r.items),
    staleTime: 60_000,
  });
  const pinned = (data ?? []).filter((l) => l.pinned);
  if (collapsed || !pinned.length) return null;
  return (
    <div className="flex flex-col gap-0.5" aria-label="Pinned lists" role="group">
      <div className="text-muted-foreground px-2.5 pb-1 text-[11px] font-medium tracking-wide uppercase">Pinned lists</div>
      {pinned.map((l) => {
        const href = `/lists/${l.id}`;
        const active = pathname === href;
        return (
          <Link key={l.id} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("text-sidebar-foreground/80 hover:bg-sidebar-accent flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium", active && "bg-sidebar-accent text-sidebar-accent-foreground")}>
            <ListFilter className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="truncate">{l.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
