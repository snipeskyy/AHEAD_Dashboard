"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useSetting } from "@/hooks/use-setting";
import { themeConfig } from "@/config/theme";
import { cn } from "@/lib/utils";
import { registry } from "@/modules/registry";
import type { AccModule } from "@/modules/types";
import { useUiStore } from "@/stores/ui-store";
import { NAV_GROUPS, routeHref } from "./nav-config";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  m,
  collapsed,
  onNavigate,
}: {
  m: AccModule;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const route = m.routes?.find((r) => r.nav);
  if (!route) return null;
  const href = routeHref(route.path);
  const active = isActive(pathname, href);
  const Icon = m.icon;
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group text-sidebar-foreground/80 flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{route.title}</span>}
      {!collapsed && m.status === "stub" && (
        <span className="border-border text-muted-foreground ml-auto rounded border px-1 text-[10px] font-medium">
          Soon
        </span>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{route.title}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const flags = useFeatureFlags();
  const modules = registry.enabled(flags);
  const home = modules.filter((m) => m.id === "command-home");
  const system = modules.filter((m) => m.category === "system");
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
      <div className="flex flex-col gap-0.5">
        {home.map((m) => (
          <NavItem key={m.id} m={m} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
      {NAV_GROUPS.map((g) => {
        const items = modules.filter(
          (m) => g.categories.includes(m.category) && m.id !== "command-home",
        );
        if (!items.length) return null;
        return (
          <div key={g.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <div className="text-muted-foreground px-2.5 pb-1 text-[11px] font-medium tracking-wide uppercase">
                {g.label}
              </div>
            )}
            {items.map((m) => (
              <NavItem key={m.id} m={m} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
      <div className="mt-auto flex flex-col gap-0.5">
        {system.map((m) => (
          <NavItem key={m.id} m={m} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useSetting("appearance");
  const mark = data?.wordmark ?? themeConfig.wordmark;
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md outline-none"
      aria-label={`${themeConfig.appName} home`}
    >
      <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-md text-[11px] font-semibold tracking-tight">
        {mark.slice(0, 3)}
      </span>
      {!collapsed && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold">{themeConfig.appName}</span>
          <span className="text-muted-foreground truncate text-[11px]">{themeConfig.tagline}</span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  return (
    <aside
      data-print-hide="true"
      className={cn(
        "border-sidebar-border bg-sidebar sticky top-0 hidden h-svh shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn(
          "border-sidebar-border flex h-14 items-center border-b px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Wordmark collapsed={collapsed} />
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className={cn("border-sidebar-border border-t p-2", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={toggle}
          className="text-muted-foreground w-full justify-start"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
