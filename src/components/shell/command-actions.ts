"use client";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useUiStore } from "@/stores/ui-store";
import type { CommandDefinition } from "@/modules/types";

/** Executes registry commands: navigation (href) or named UI actions. */
export function useRunCommand() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const presentation = useUiStore((s) => s.presentationMode);
  const setPresentation = useUiStore((s) => s.setPresentationMode);
  const openNote = useUiStore((s) => s.openNoteDialog);

  return useCallback(
    (cmd: Pick<CommandDefinition, "href" | "action">) => {
      if (cmd.href) return router.push(cmd.href);
      switch (cmd.action) {
        case "theme.toggle":
          return setTheme(resolvedTheme === "dark" ? "light" : "dark");
        case "presentation.toggle":
          return setPresentation(!presentation);
        case "note.create":
          return openNote();
        case "task.create":
          return useUiStore.getState().openTaskDialog();
        case "capture.open":
          return useUiStore.getState().setCaptureOpen(true);
        case "help.open":
          return useUiStore.getState().setHelpOpen(true);
        case "opportunity.create":
          return router.push("/opportunities?create=1");
        default:
          console.warn("Unknown command action", cmd.action);
      }
    },
    [router, resolvedTheme, setTheme, presentation, setPresentation, openNote],
  );
}
