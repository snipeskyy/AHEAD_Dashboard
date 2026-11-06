"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface TerritoryRow {
  id: string;
  name: string;
  tier: string;
  industry: string;
  healthScore: number;
  whitespaceScore: number;
  openPipeline: number;
  lastTouchAt: string | null;
  cadenceDays: number;
  cadence: { status: "never" | "overdue" | "due-soon" | "ok"; overdueDays: number; daysSinceTouch: number | null; dueAt: string | null };
  momentum: number;
  momentumParts: { signals: number; stageMoves: number; touches: number; newOpps: number };
  fiscal: { fye: string; phase: "upcoming" | "in-window" | "closing"; label: string; start: string; end: string; fiscalYearStart: string; weeksUntilStart: number } | null;
}
export interface Territory {
  rows: TerritoryRow[];
  neglected: TerritoryRow[];
  momentum: TerritoryRow[];
  cadence: Record<string, number>;
}

export const useTerritory = () => useQuery({ queryKey: ["territory"], queryFn: () => api<Territory>("/api/territory"), staleTime: 60_000 });
