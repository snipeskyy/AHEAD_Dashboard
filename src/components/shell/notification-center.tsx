"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, CheckCheck, Radio } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationCenter() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: NotificationItem[]; unread: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });
  const readAll = useMutation({
    mutationFn: () => api("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/api/notifications/${id}`, { method: "PATCH", json: { read: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.unread ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground tabular absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-muted-foreground text-xs">
              {unread ? `${unread} unread` : "You're all caught up"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {!data?.items.length ? (
            <div className="text-muted-foreground px-4 py-10 text-center text-sm">
              No notifications yet. High-relevance signals will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                    className="hover:bg-muted/60 flex gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <span
                      className={cn(
                        "bg-muted mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
                        !n.read && "bg-brand-soft text-primary",
                      )}
                    >
                      <Radio className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "line-clamp-2 text-[13px]",
                          !n.read ? "font-medium" : "text-muted-foreground",
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {n.body ? `${n.body} · ` : ""}
                        {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                    {!n.read && (
                      <span
                        className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
                        aria-label="Unread"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
