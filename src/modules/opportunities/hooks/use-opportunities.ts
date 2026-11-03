"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Meddpicc, Stage } from "@/lib/domain/enums";
import type { OppRow } from "@/lib/pipeline/types";

export interface OppDetail extends OppRow {
  meddpicc: Meddpicc;
  stageHistory: Array<{ id: string; fromStage: string | null; toStage: string; changedAt: string }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
}

export type OppPatch = Partial<{
  name: string;
  stage: Stage;
  amount: number;
  closeDate: string;
  probability: number;
  forecastCategory: string;
  nextStep: string | null;
  practiceArea: string;
  partners: string[];
  competitors: string[];
  meddpicc: Meddpicc;
}>;

export const oppKeys = {
  list: (scope: string) => ["opportunities", scope] as const,
  detail: (id: string) => ["opportunity", id] as const,
};

export function useOpportunities(
  opts: { accountId?: string; status?: "open" | "closed" | "all" } = {},
) {
  const qs = new URLSearchParams({
    status: opts.status ?? "all",
    ...(opts.accountId ? { accountId: opts.accountId } : {}),
  });
  return useQuery({
    queryKey: oppKeys.list(qs.toString()),
    queryFn: () => api<{ items: OppRow[] }>(`/api/opportunities?${qs}`).then((r) => r.items),
  });
}

export function useOpportunity(id: string | null) {
  return useQuery({
    queryKey: oppKeys.detail(id ?? ""),
    queryFn: () => api<OppDetail>(`/api/opportunities/${id}`),
    enabled: !!id,
  });
}

/** Patch with optimistic update across every cached opportunity list. */
export function useUpdateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OppPatch }) =>
      api<OppRow>(`/api/opportunities/${id}`, { method: "PATCH", json: patch }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["opportunities"] });
      const snapshots = qc.getQueriesData<OppRow[]>({ queryKey: ["opportunities"] });
      for (const [key, rows] of snapshots) {
        if (!rows) continue;
        qc.setQueryData<OppRow[]>(
          key,
          rows.map((r) => (r.id === id ? ({ ...r, ...patch, meddpicc: undefined } as OppRow) : r)),
        );
      }
      const detailKey = oppKeys.detail(id);
      const prevDetail = qc.getQueryData<OppDetail>(detailKey);
      if (prevDetail)
        qc.setQueryData<OppDetail>(detailKey, { ...prevDetail, ...patch } as OppDetail);
      return { snapshots, prevDetail };
    },
    onError: (e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, rows]) => qc.setQueryData(key, rows));
      if (ctx?.prevDetail) qc.setQueryData(oppKeys.detail(ctx.prevDetail.id), ctx.prevDetail);
      toast.error(`Update failed: ${e.message}`);
    },
    onSuccess: (row) => {
      for (const [key, rows] of qc.getQueriesData<OppRow[]>({ queryKey: ["opportunities"] })) {
        if (rows)
          qc.setQueryData<OppRow[]>(
            key,
            rows.map((r) => (r.id === row.id ? row : r)),
          );
      }
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: oppKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      accountId: string;
      name: string;
      practiceArea: string;
      stage: Stage;
      amount: number;
      closeDate: string;
      nextStep?: string | null;
      sourceSignalId?: string | null;
    }) => api<OppRow>("/api/opportunities", { method: "POST", json: input }),
    onSuccess: (row) => {
      toast.success(`Created ${row.name}`);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });
}

export interface PipelineSummary {
  kpis: import("@/lib/pipeline/analytics").Kpis;
  targets: { quarterly: number; monthly: number };
  forecast: {
    months: import("@/lib/pipeline/analytics").ForecastBucket[];
    quarters: import("@/lib/pipeline/analytics").ForecastBucket[];
  };
  byStage: Array<{ stage: string; amount: number; count: number }>;
  byPractice: Array<{ practiceArea: string; amount: number; count: number }>;
  conversion: Array<{ stage: string; reached: number; advanced: number; rate: number | null }>;
  velocity: Array<{ stage: string; avgDays: number | null; samples: number }>;
  aging: Array<{ stage: string; buckets: number[] }>;
  creation: Array<{ month: string; amount: number; count: number }>;
}

export function usePipelineSummary(accountId?: string) {
  return useQuery({
    queryKey: ["pipeline", accountId ?? "all"],
    queryFn: () =>
      api<PipelineSummary>(`/api/pipeline${accountId ? `?accountId=${accountId}` : ""}`),
  });
}
