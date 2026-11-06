"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "done" | "cancelled";
  recurrence: string | null;
  source: string;
  completedAt: string | null;
  account: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
}

export const useTasks = (q: { status?: string; accountId?: string; due?: string } = {}) => {
  const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as Array<[string, string]>);
  return useQuery({ queryKey: ["tasks", q], queryFn: () => api<{ items: TaskRow[] }>(`/api/tasks?${params}`).then((r) => r.items) });
};

export function useTaskUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api<{ next: { dueDate: string } | null }>(`/api/tasks/${id}`, { method: "PATCH", json: patch }),
    onSuccess: (r) => {
      if (r.next) toast.success(`Done. Next one scheduled for ${new Date(r.next.dueDate).toLocaleDateString()}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
    },
    onError: (e) => toast.error(e.message),
  });
}
