"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Meta {
  demo: boolean;
  testDb: boolean;
  counts: {
    demoAccounts: number;
    realAccounts: number;
    opportunities: number;
    signals: number;
  };
  /** True until the user has at least one account (drives the first-run onboarding). */
  empty: boolean;
  unreadNotifications: number;
}

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: () => api<Meta>("/api/meta"), refetchInterval: 60_000 });
