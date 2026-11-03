"use client";
import { useEffect } from "react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { registry } from "@/modules/registry";
import { useUiStore } from "@/stores/ui-store";
import { useRunCommand } from "./command-actions";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** ⌘K / Ctrl+K opens the palette; two-key "G X" sequences come from registry command shortcuts. */
export function KeyboardShortcuts() {
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const run = useRunCommand();
  const flags = useFeatureFlags();

  useEffect(() => {
    const sequences = new Map<string, () => void>();
    for (const c of registry.commands(flags)) {
      if (c.shortcut?.includes(" ")) sequences.set(c.shortcut.toLowerCase(), () => run(c));
    }
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
        return;
      }
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        useUiStore.getState().commandOpen
      )
        return;
      const key = e.key.toLowerCase();
      if (pending) {
        const fn = sequences.get(`${pending} ${key}`);
        pending = null;
        clearTimeout(timer);
        if (fn) {
          e.preventDefault();
          fn();
        }
        return;
      }
      if ([...sequences.keys()].some((s) => s.startsWith(key + " "))) {
        pending = key;
        timer = setTimeout(() => (pending = null), 1000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [flags, run, setOpen]);
  return null;
}
