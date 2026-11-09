"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { api } from "@/lib/api-client";

interface Person {
  user: { id: string; displayName: string; title: string | null; isSelf: boolean };
  open: number;
  overdue: number;
  dueThisWeek: number;
  doneThisWeek: number;
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    priority: string;
    account: { id: string; name: string } | null;
    assigneeId: string | null;
  }>;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date";

/** Open tasks per teammate. Reassign with the select; unassigned tasks are yours. */
export function Workload() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["team-workload"],
    queryFn: () => api<{ people: Person[] }>("/api/team-workspace/workload").then((r) => r.people),
  });
  const assign = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      api(`/api/tasks/${id}`, { method: "PATCH", json: { assigneeId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-workload"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task reassigned");
    },
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading) return <CardSkeleton lines={6} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const people = q.data ?? [];
  const self = people.find((p) => p.user.isSelf);
  if (!people.some((p) => p.open))
    return (
      <EmptyState
        icon={UsersRound}
        title="No open tasks"
        description="Tasks you create (press T) show here by assignee. Add teammates by name in Settings → Profile & team."
      />
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {people.map((p) => (
        <section
          key={p.user.id}
          className="bg-card rounded-lg border"
          aria-label={`Tasks for ${p.user.displayName}`}
        >
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              {p.user.displayName}
              {p.user.isSelf ? " (you)" : ""}
            </h2>
            {p.user.title && <span className="text-muted-foreground text-xs">{p.user.title}</span>}
            <span className="tabular text-muted-foreground ml-auto text-xs">
              {p.open} open ·{" "}
              <span className={p.overdue ? "text-critical-text font-medium" : ""}>
                {p.overdue} overdue
              </span>{" "}
              · {p.dueThisWeek} due this week · {p.doneThisWeek} done this week
            </span>
          </header>
          {p.tasks.length === 0 ? (
            <p className="text-muted-foreground px-4 py-3 text-[13px]">Nothing open.</p>
          ) : (
            <ul className="divide-y">
              {p.tasks.map((t) => {
                const late = t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px]"
                  >
                    <span className="min-w-0 flex-1">
                      {t.title}
                      {t.account && (
                        <Link
                          href={`/accounts/${t.account.id}`}
                          className="text-muted-foreground ml-1.5 text-xs hover:underline"
                        >
                          {t.account.name}
                        </Link>
                      )}
                    </span>
                    <span
                      className={`tabular text-xs ${late ? "text-critical-text font-medium" : "text-muted-foreground"}`}
                    >
                      {late ? "⚠ " : ""}
                      {fmt(t.dueDate)}
                    </span>
                    <select
                      aria-label={`Assignee for ${t.title}`}
                      className="border-input dark:bg-input/30 h-7 rounded-md border bg-transparent px-1.5 text-xs"
                      value={t.assigneeId ?? self?.user.id ?? ""}
                      onChange={(e) =>
                        assign.mutate({
                          id: t.id,
                          assigneeId: e.target.value === self?.user.id ? null : e.target.value,
                        })
                      }
                    >
                      {people.map((o) => (
                        <option key={o.user.id} value={o.user.id}>
                          {o.user.displayName}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
