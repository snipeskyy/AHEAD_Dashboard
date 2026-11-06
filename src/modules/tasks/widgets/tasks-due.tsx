"use client";
import { ListTodo } from "lucide-react";
import { WidgetEmpty } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "@/modules/types";
import { TaskList } from "../components/task-list";
import { useTasks } from "../components/use-tasks";

export default function TasksDueWidget({ height }: WidgetProps) {
  const { data, isLoading } = useTasks({ status: "open", due: "week" });
  if (isLoading) return <Skeleton style={{ height }} />;
  if (!data?.length) return <WidgetEmpty height={height} icon={ListTodo} title="Nothing due this week" description="Press T anywhere to add a task." />;
  return (
    <div className="-mx-1 overflow-y-auto px-1" style={{ height }}>
      <TaskList items={data} compact />
    </div>
  );
}
