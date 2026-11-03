"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  presentationMode: boolean;
  commandOpen: boolean;
  activeLayoutId: string | null;
  setActiveLayoutId: (id: string | null) => void;
  noteDialog: { open: boolean; entityType?: string; entityId?: string };
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
