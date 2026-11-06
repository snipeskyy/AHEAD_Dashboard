"use client";
import { differenceInCalendarDays } from "date-fns";
import { CheckCircle2, ListTodo, Plus } from "lucide-react";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUiStore } from "@/stores/ui-store";
import { TaskList } from "../components/task-list";
import { useTasks, type TaskRow } from "../components/use-tasks";

const GROUPS: Array<[string, (d: number | null) => boolean]> = [
  ["Overdue", (d) => d !== null && d < 0],
  ["Today", (d) => d === 0],
  ["Next 7 days", (d) => d !== null && d > 0 && d <= 7],
  ["Later", (d) => d !== null && d > 7],
  ["No date", (d) => d === null],
];

export default function TasksPage() {
  const [status, setStatus] = useState<"open" | "done">("open");
  const { data, isLoading, error, refetch } = useTasks({ status });
  const openTask = useUiStore((s) => s.openTaskDialog);
  const now = new Date();
  const dd = (t: TaskRow) => (t.dueDate ? differenceInCalendarDays(new Date(t.dueDate), now) : null);
  return (
    <PageContainer>
      <PageHeader
        title="Tasks"
        description="Follow-ups across your accounts and deals. Press T anywhere to add one; C to capture meeting notes."
        actions={<Button size="sm" onClick={() => openTask()}><Plus /> New task</Button>}
      />
      <ToggleGroup type="single" variant="outline" size="sm" value={status} onValueChange={(v) => v && setStatus(v as "open" | "done")} aria-label="Task status" className="w-fit">
        <ToggleGroupItem value="open">Open</ToggleGroupItem>
        <ToggleGroupItem value="done">Done</ToggleGroupItem>
      </ToggleGroup>
      {isLoading ? (
        <CardSkeleton lines={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={status === "open" ? ListTodo : CheckCircle2} title={status === "open" ? "No open tasks" : "Nothing completed yet"} description={status === "open" ? "Add one with T, or capture meeting notes with C: action lines become tasks." : undefined} action={status === "open" ? <Button size="sm" onClick={() => openTask()}><Plus /> New task</Button> : undefined} />
      ) : status === "done" ? (
        <section className="bg-card rounded-lg border px-4 py-2"><TaskList items={data} /></section>
      ) : (
        <div className="grid gap-4">
          {GROUPS.map(([label, test]) => {
            const items = data.filter((t) => test(dd(t)));
            if (!items.length) return null;
            return (
              <section key={label} className="bg-card rounded-lg border px-4 py-2" aria-label={label}>
                <h2 className={`pt-1 text-xs font-semibold tracking-wide uppercase ${label === "Overdue" ? "text-critical-text" : "text-muted-foreground"}`}>{label} · {items.length}</h2>
                <TaskList items={items} />
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
