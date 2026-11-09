"use client";
import { differenceInCalendarDays, format } from "date-fns";
import { Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useTaskUpdate, type TaskRow } from "./use-tasks";

const PRIORITY: Record<TaskRow["priority"], string> = { urgent: "text-critical-text", high: "text-warning-text", normal: "text-muted-foreground", low: "text-muted-foreground" };

export function dueLabel(due: string | null, now = new Date()) {
  if (!due) return { text: "No date", tone: "text-muted-foreground" };
  const d = differenceInCalendarDays(new Date(due), now);
  if (d < 0) return { text: `Overdue ${-d}d`, tone: "text-critical-text" };
  if (d === 0) return { text: "Today", tone: "text-warning-text" };
  if (d === 1) return { text: "Tomorrow", tone: "text-foreground" };
  return { text: format(new Date(due), "EEE MMM d"), tone: "text-muted-foreground" };
}

/** Checkable task rows with due/priority/recurrence and links to the account / opportunity. */
export function TaskList({ items, compact = false }: { items: TaskRow[]; compact?: boolean }) {
  const update = useTaskUpdate();
  const qc = useQueryClient();
  const users =
    useQuery({
      queryKey: ["users", "list"],
      queryFn: () => api<{ users: Array<{ id: string; displayName: string }> }>("/api/users").then((r) => r.users),
    }).data ?? [];
  const nameOf = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.displayName : undefined);
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  return (
    <ul className="divide-y">
      {items.map((t) => {
        const due = dueLabel(t.dueDate);
        const done = t.status === "done";
        return (
          <li key={t.id} className={cn("group flex items-start gap-2.5 py-2", compact && "py-1.5")}>
            <Checkbox className="mt-0.5" checked={done} aria-label={`${done ? "Reopen" : "Complete"}: ${t.title}`} onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "done" : "open" } })} />
            <div className="min-w-0 flex-1">
              <div className={cn("text-[13px]", done && "text-muted-foreground line-through")}>{t.title}</div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                {!done && <span className={due.tone}>{due.text}</span>}
                {t.priority !== "normal" && <span className={PRIORITY[t.priority]}>{t.priority}</span>}
                {nameOf(t.assigneeId) && <span className="text-foreground">→ {nameOf(t.assigneeId)}</span>}
                {t.recurrence && <span className="inline-flex items-center gap-0.5"><Repeat className="size-3" aria-hidden /> {t.recurrence}</span>}
                {t.account && <Link href={`/accounts/${t.account.id}`} className="hover:text-foreground truncate hover:underline">{t.account.name}</Link>}
                {t.opportunity && <Link href={`/opportunities?focus=${t.opportunity.id}`} className="hover:text-foreground truncate hover:underline">{t.opportunity.name}</Link>}
              </div>
            </div>
            {!compact && (
              <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Delete ${t.title}`} onClick={() => del.mutate(t.id)}>
                <Trash2 />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
