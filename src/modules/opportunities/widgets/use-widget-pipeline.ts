"use client";
import { useOpportunities } from "../hooks/use-opportunities";
import { usePipelineAnalytics } from "../hooks/use-pipeline-data";

/** Shared by pipeline widgets: one cached opportunities query, analytics computed client-side. */
export function useWidgetPipeline() {
  const q = useOpportunities();
  const a = usePipelineAnalytics(q.data ?? [], []);
  return { ...q, a };
}
