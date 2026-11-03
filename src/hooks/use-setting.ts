"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { SettingKey, SettingValue } from "@/lib/settings/schema";

export function useSetting<K extends SettingKey>(key: K) {
  return useQuery({
    queryKey: ["setting", key],
    queryFn: () => api<{ value: SettingValue<K> }>(`/api/settings/${key}`).then((r) => r.value),
  });
}

export function useSaveSetting<K extends SettingKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: SettingValue<K>) =>
      api<{ value: SettingValue<K> }>(`/api/settings/${key}`, {
        method: "PUT",
        json: { value },
      }).then((r) => r.value),
    onSuccess: (value) => qc.setQueryData(["setting", key], value),
  });
}
