"use client";
import { Menu, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUiStore } from "@/stores/ui-store";
import { TestDbChip } from "./data-guard";
import { NotificationCenter } from "./notification-center";
import { PresentationToggle } from "./presentation-toggle";
import { SidebarNav, Wordmark } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header
      data-print-hide="true"
      className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:px-6"
    >
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-sidebar w-72 p-0">
          <SheetHeader className="h-14 justify-center border-b px-3">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Wordmark />
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="bg-card text-muted-foreground hover:bg-muted/60 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 text-[13px] shadow-xs transition-colors sm:max-w-md"
        aria-label="Search or run a command"
      >
        <Search className="size-4" aria-hidden />
        <span className="truncate">
          <span className="sm:hidden">Search…</span>
          <span className="hidden sm:inline">Search accounts, opps, signals…</span>
        </span>
        <kbd className="bg-muted text-muted-foreground ml-auto hidden rounded border px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <TestDbChip />
        <PresentationToggle />
        <ThemeToggle />
        <NotificationCenter />
      </div>
    </header>
  );
}
