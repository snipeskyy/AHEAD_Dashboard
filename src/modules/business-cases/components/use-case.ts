"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { TcoModelSchema, type TcoModel } from "@/lib/tco/model";

export interface CaseDTO {
  id: string;
  name: string;
  status: "draft" | "final";
  version: number;
  model: TcoModel;
  accountId: string | null;
  opportunityId: string | null;
  account: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
  versions: Array<{ id: string; version: number; label: string | null; createdAt: string }>;
  updatedAt: string;
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(n) >= 1e6 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(n) >= 1e6 ? 2 : 0,
  }).format(n);

/**
 * Loads a business case and keeps an editable copy of its model. Valid edits autosave after a short pause;
 * the results recompute instantly on the client (the math is pure).
 */
export function useCase(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-case", id],
    queryFn: () => api<CaseDTO>(`/api/business-cases/${id}`),
  });
  const [draft, setDraft] = useState<TcoModel | null>(null);
  const model = draft ?? q.data?.model ?? null;
  const save = useMutation({
    mutationFn: (patch: Partial<Pick<CaseDTO, "name" | "status">> & { model?: TcoModel }) =>
      api(`/api/business-cases/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business-cases"] }),
    onError: (e) => toast.error(e.message),
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const edit = (m: TcoModel) => {
    setDraft(m);
    if (timer.current) clearTimeout(timer.current);
    if (TcoModelSchema.safeParse(m).success)
      timer.current = setTimeout(() => save.mutate({ model: m }), 600);
  };
  const version = useMutation({
    // Flush any pending autosave first, so the version captures exactly what's on screen.
    mutationFn: async (label: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (draft && TcoModelSchema.safeParse(draft).success)
        await api(`/api/business-cases/${id}`, { method: "PATCH", json: { model: draft } });
      return api(`/api/business-cases/${id}/versions`, {
        method: "POST",
        json: { label: label || null },
      });
    },
    onSuccess: () => {
      toast.success("Version saved");
      qc.invalidateQueries({ queryKey: ["business-case", id] });
    },
    onError: (e) => toast.error(e.message),
  });
  return {
    ...q,
    model,
    edit,
    save,
    version,
    valid: model ? TcoModelSchema.safeParse(model) : null,
  };
}

/** Short random id for new lines/scenarios (client-only, no Date.now in render). */
export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 7)}`;
