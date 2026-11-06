"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TaskDefaults {
  title?: string;
  account?: { id: string; name: string };
  opportunityId?: string;
  signalId?: string;
  dueDate?: string;
  source?: "manual" | "signal" | "quick-capture" | "next-step" | "my-day";
}

interface UiState {
  sidebarCollapsed: boolean;
  presentationMode: boolean;
  commandOpen: boolean;
  activeLayoutId: string | null;
  setActiveLayoutId: (id: string | null) => void;
  noteDialog: { open: boolean; entityType?: string; entityId?: string };
  /** Phase 7 global dialogs. */
  taskDialog: { open: boolean; defaults?: TaskDefaults };
  captureOpen: boolean;
  captureAccount?: { id: string; name: string };
  helpOpen: boolean;
  /** True while the triage queue owns single-key shortcuts (t, n, …). */
  triageActive: boolean;
  openTaskDialog: (defaults?: TaskDefaults) => void;
  closeTaskDialog: () => void;
  setCaptureOpen: (v: boolean, account?: { id: string; name: string }) => void;
  setHelpOpen: (v: boolean) => void;
  setTriageActive: (v: boolean) => void;
  toggleSidebar: () => void;
  setPresentationMode: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  openNoteDialog: (entityType?: string, entityId?: string) => void;
  closeNoteDialog: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      presentationMode: false,
      commandOpen: false,
      activeLayoutId: null,
      setActiveLayoutId: (id) => set({ activeLayoutId: id }),
      noteDialog: { open: false },
      taskDialog: { open: false },
      captureOpen: false,
      helpOpen: false,
      triageActive: false,
      openTaskDialog: (defaults) => set({ taskDialog: { open: true, defaults } }),
      closeTaskDialog: () => set({ taskDialog: { open: false } }),
      setCaptureOpen: (v, account) => set({ captureOpen: v, captureAccount: v ? account : undefined }),
      setHelpOpen: (v) => set({ helpOpen: v }),
      setTriageActive: (v) => set({ triageActive: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPresentationMode: (v) => set({ presentationMode: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      openNoteDialog: (entityType, entityId) =>
        set({ noteDialog: { open: true, entityType, entityId } }),
      closeNoteDialog: () => set({ noteDialog: { open: false } }),
    }),
    {
      name: "acc-ui",
      // Rehydrated after mount (see PresentationModeSync) so SSR and first client render match.
      skipHydration: true,
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        presentationMode: s.presentationMode,
        activeLayoutId: s.activeLayoutId,
      }),
    },
  ),
);
