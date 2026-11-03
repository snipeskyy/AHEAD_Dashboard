"use client";
import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

/**
 * 1) Rehydrates persisted UI state after mount (avoids SSR hydration mismatches).
 * 2) Mirrors Presentation Mode onto <html data-presentation> so CSS can hide internal-only UI.
 */
export function PresentationModeSync() {
  const on = useUiStore((s) => s.presentationMode);
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-presentation", on ? "true" : "false");
  }, [on]);
  return null;
}
