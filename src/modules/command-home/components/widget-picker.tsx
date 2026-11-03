"use client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { registry } from "@/modules/registry";

/** Lists every widget declared by enabled modules (registry-driven; no shell edits needed). */
export function WidgetPicker({
  open,
  onOpenChange,
  onAdd,
  placed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (widgetId: string) => void;
  placed: string[];
}) {
  const flags = useFeatureFlags();
  const widgets = registry.widgets(flags);
  const byModule = new Map<string, typeof widgets>();
  for (const w of widgets) byModule.set(w.moduleId, [...(byModule.get(w.moduleId) ?? []), w]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a widget</SheetTitle>
          <SheetDescription>
            Widgets come from installed modules. A widget can be added more than once.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          {[...byModule.entries()].map(([moduleId, ws]) => (
            <section key={moduleId}>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                {registry.get(moduleId)?.title}
              </h3>
              <ul className="grid gap-2">
                {ws.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{w.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {w.description}
                        {placed.includes(w.id) && " · on this layout"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAdd(w.id)}
                      aria-label={`Add ${w.title}`}
                    >
                      <Plus /> Add
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
