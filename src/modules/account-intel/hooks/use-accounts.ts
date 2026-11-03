"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { AccountRow, Account360 } from "@/lib/server/accounts";

export type { AccountRow, Account360 };

export const useAccounts = () =>
  useQuery({
    queryKey: ["accounts"],
    queryFn: () => api<{ items: AccountRow[] }>("/api/accounts").then((r) => r.items),
  });

export const useAccount360 = (id: string) =>
  useQuery({ queryKey: ["account", id], queryFn: () => api<Account360>(`/api/accounts/${id}`) });

/** Generic mutation that refreshes the account (and lists) afterwards. */
export function useAccountMutation<TVars>(
  accountId: string,
  fn: (v: TVars) => Promise<unknown>,
  success?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success);
      qc.invalidateQueries({ queryKey: ["account", accountId] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["account-activity", accountId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });
}
