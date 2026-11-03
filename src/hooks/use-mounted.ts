"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** True only on the client after hydration — for UI that depends on client-only state (e.g. theme). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
