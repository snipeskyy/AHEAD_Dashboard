"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { SandboxSpecSchema, type SandboxSpec } from "../lib/spec";

export interface ScenarioDTO {
  id: string;
  name: string;
  description: string | null;
  accountId: string | null;
  account: { id: string; name: string } | null;
  baseId: string | null;
  base: { id: string; name: string; spec: SandboxSpec } | null;
  spec: SandboxSpec;
  updatedAt: string;
}

const LIMIT = 100;

/**
 * Editable scenario with undo/redo (up to 100 steps) and debounced autosave of valid specs.
 * `commit` records a history step; `preview` updates without one (e.g. while dragging).
 */
export function useScenario(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["sandbox", id],
    queryFn: () => api<ScenarioDTO>(`/api/sandbox/${id}`),
  });
  const [hist, setHist] = useState<{
    past: SandboxSpec[];
    present: SandboxSpec | null;
    future: SandboxSpec[];
  }>({ past: [], present: null, future: [] });
  const spec = hist.present ?? q.data?.spec ?? null;
  const save = useMutation({
    mutationFn: (s: SandboxSpec) =>
      api(`/api/sandbox/${id}`, { method: "PATCH", json: { spec: s } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sandbox-list"] }),
    onError: (e) => toast.error(e.message),
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const schedule = (s: SandboxSpec) => {
    if (timer.current) clearTimeout(timer.current);
    if (SandboxSpecSchema.safeParse(s).success)
      timer.current = setTimeout(() => save.mutate(s), 700);
  };
  const commit = (next: SandboxSpec) => {
    if (!spec) return;
    setHist((h) => ({
      past: [...h.past, h.present ?? spec].slice(-LIMIT),
      present: next,
      future: [],
    }));
    schedule(next);
  };
  const preview = (next: SandboxSpec) => setHist((h) => ({ ...h, present: next }));
  const undo = () =>
    setHist((h) => {
      if (!h.past.length || !spec) return h;
      const prev = h.past[h.past.length - 1];
      schedule(prev);
      return { past: h.past.slice(0, -1), present: prev, future: [h.present ?? spec, ...h.future] };
    });
  const redo = () =>
    setHist((h) => {
      if (!h.future.length || !spec) return h;
      const next = h.future[0];
      schedule(next);
      return { past: [...h.past, h.present ?? spec], present: next, future: h.future.slice(1) };
    });
  return {
    ...q,
    spec,
    commit,
    preview,
    undo,
    redo,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    saving: save.isPending,
  };
}

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 7)}`;
