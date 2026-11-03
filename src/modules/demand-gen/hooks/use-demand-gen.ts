"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Reason } from "@/lib/demand-gen/recommender";

export interface Play {
  id: string;
  slug: string;
  name: string;
  practiceArea: string;
  targetPersonas: string[];
  triggerKeywords: string[];
  triggerSignalTypes: string[];
  valueHypothesis: string;
  talkTrack: string[];
  sequence: Array<{ day: number; channel: string; description: string }>;
  assetsNeeded: string[];
  successMetrics: string[];
  isDemo: boolean;
  stats: {
    campaigns: number;
    touches: number;
    completed: number;
    replies: number;
    meetings: number;
    opps: number;
  };
}

export interface Recommendation {
  play: Play;
  score: number;
  reasons: Reason[];
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  startDate: string;
  accountId: string | null;
  accountName: string | null;
  playId: string | null;
  playName: string | null;
  practiceArea: string | null;
  touches: number;
  completed: number;
  meetings: number;
  nextTouchAt: string | null;
}

export interface Touch {
  id: string;
  accountId: string;
  campaignId: string | null;
  channel: string;
  persona: string;
  angle: string | null;
  scheduledAt: string;
  completedAt: string | null;
  outcome: string | null;
  sourceSignalId: string | null;
  account: { name: string; tier: string };
  campaign: { name: string } | null;
}

export const usePlays = () =>
  useQuery({
    queryKey: ["plays"],
    queryFn: () => api<{ items: Play[] }>("/api/plays").then((r) => r.items),
  });
export const useCampaigns = () =>
  useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<{ items: Campaign[] }>("/api/campaigns").then((r) => r.items),
  });
export const useTouchesInRange = (from: Date, to: Date) =>
  useQuery({
    queryKey: ["touches", "range", from.toISOString(), to.toISOString()],
    queryFn: () =>
      api<{ items: Touch[] }>(
        `/api/touches?from=${from.toISOString()}&to=${to.toISOString()}&limit=2000`,
      ).then((r) => r.items),
  });

export function useInvalidateDemandGen() {
  const qc = useQueryClient();
  return () => {
    for (const k of [
      "plays",
      "campaigns",
      "touches",
      "dg-metrics",
      "recommend",
      "dashboard",
      "account",
    ])
      qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useLaunchPlay() {
  const inv = useInvalidateDemandGen();
  return useMutation({
    mutationFn: (b: { playId: string; accountId: string; startDate?: string }) =>
      api<{ id: string; touches: number }>("/api/campaigns", { method: "POST", json: b }),
    onSuccess: (r) => {
      toast.success(`Campaign created with ${r.touches} planned touches`);
      inv();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useTouchPatch() {
  const inv = useInvalidateDemandGen();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api<Touch>(`/api/touches/${id}`, { method: "PATCH", json: patch }),
    onSuccess: inv,
    onError: (e) => toast.error(e.message),
  });
}
