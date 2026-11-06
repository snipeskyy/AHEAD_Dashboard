"use client";
import { useQuery } from "@tanstack/react-query";
import type { VisibilityField } from "@/config/roles";
import { api } from "@/lib/api-client";
import type { SessionUser } from "@/lib/auth/provider";

export interface Me {
  user: SessionUser;
  role: { id: string; label: string; hidden: VisibilityField[]; exportHidden: string[] };
  auth: { id: string; label: string };
}

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/me"), staleTime: 60_000 });

/** Whether the current role may see a field. Visible while loading, so nothing flickers away for the default roles. */
export function useCanSee(field: VisibilityField) {
  const { data } = useMe();
  return !data?.role.hidden.includes(field);
}
