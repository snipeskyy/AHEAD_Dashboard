import type { ReactNode } from "react";
import { LiveSignalsProvider } from "@/components/providers/live-signals";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NoteDialog } from "./note-dialog";
import { Sidebar } from "./sidebar";
import { DemoDataWarning } from "./data-guard";
import { PresentationBanner } from "./presentation-toggle";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LiveSignalsProvider>
      <div className="flex min-h-svh">
        <a
          href="#main"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <DemoDataWarning />
          <PresentationBanner />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
        <CommandPalette />
        <NoteDialog />
        <KeyboardShortcuts />
      </div>
    </LiveSignalsProvider>
  );
}
