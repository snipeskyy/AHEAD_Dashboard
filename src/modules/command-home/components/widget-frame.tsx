"use client";
import { GripVertical, X } from "lucide-react";
import { createElement, lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { bodyHeight } from "@/lib/dashboard/layouts";
import { registry } from "@/modules/registry";
import type { WidgetProps, WidgetSize } from "@/modules/types";
import { cn } from "@/lib/utils";

/** Lazy widget components, created once at module load from the registry (never during render). */
const LAZY_WIDGETS = new Map<string, LazyExoticComponent<ComponentType<WidgetProps>>>(registry.widgets().map((w) => [w.id, lazy(w.load)]));

export function sizeFromWidth(w: number): WidgetSize {
  return w >= 10 ? "xl" : w >= 6 ? "lg" : w >= 4 ? "md" : "sm";
}

/** Card chrome around a widget: drag handle (edit mode), title, remove; body is lazy-loaded from the registry. */
export function WidgetFrame({
  widgetId,
  w,
  h,
  editing,
  onRemove,
  fixedHeight,
}: {
  widgetId: string;
  w: number;
  h: number;
  editing: boolean;
  onRemove?: () => void;
  fixedHeight?: number;
}) {
  const def = registry.widget(widgetId);
  const Body = LAZY_WIDGETS.get(widgetId) ?? null;
  const height = fixedHeight ?? bodyHeight(h);
  return (
    <section
      aria-label={def?.title ?? widgetId}
      className={cn(
        "bg-card flex h-full flex-col overflow-hidden rounded-lg border",
        editing && "ring-primary/30 ring-1",
      )}
    >
      <header
        className={cn(
          "flex h-11 shrink-0 items-center gap-1.5 border-b px-4",
          editing && "widget-drag-handle cursor-grab active:cursor-grabbing",
        )}
      >
        {editing && <GripVertical className="text-muted-foreground -ml-2 size-4" aria-hidden />}
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {def?.title ?? "Unknown widget"}
        </h2>
        {editing && onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${def?.title ?? "widget"}`}
            onClick={onRemove}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X />
          </Button>
        )}
      </header>
      <div className={cn("min-h-0 flex-1 px-4 pt-2", editing && "pointer-events-none select-none")}>
        {!Body ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            This widget&apos;s module is unavailable or disabled.
          </p>
        ) : (
          <ErrorBoundary>
            <Suspense fallback={<Skeleton style={{ height }} />}>
              {/* Body is a stable module-level lazy component looked up by id. */}
              {createElement(Body, { size: sizeFromWidth(w), height })}
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </section>
  );
}
