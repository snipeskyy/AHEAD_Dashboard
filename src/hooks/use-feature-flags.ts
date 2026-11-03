"use client";
import { useSetting } from "./use-setting";

/** Feature flags (module.<id> → boolean). Missing flags default to on. */
export function useFeatureFlags(): Record<string, boolean> {
  const { data } = useSetting("featureFlags");
  return data ?? {};
}
