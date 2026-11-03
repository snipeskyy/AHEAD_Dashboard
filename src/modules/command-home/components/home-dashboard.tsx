"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LayoutGrid, Plus, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import {
  GRID_COLS,
  GRID_MARGIN,
  ROW_HEIGHT,
  SIZE_DIMENSIONS,
  type PlacedWidget,
} from "@/lib/dashboard/layouts";
import { registry } from "@/modules/registry";
import { useUiStore } from "@/stores/ui-store";
import { HomeKpis } from "./home-kpis";
import { WidgetFrame } from "./widget-frame";
import { WidgetPicker } from "./widget-picker";

interface LayoutRow {
  id: string;
  name: string;
  widgets: PlacedWidget[];
  isDefault: boolean;
}

export function HomeDashboard() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["layouts"],
    queryFn: () => api<{ items: LayoutRow[] }>("/api/layouts").then((r) => r.items),
  });
  const activeId = useUiStore((s) => s.activeLayoutId);
  const setActiveId = useUiStore((s) => s.setActiveLayoutId);
  const active =
    data?.find((l) => l.id === activeId) ?? data?.find((l) => l.isDefault) ?? data?.[0];

  const [draft, setDraft] = useState<PlacedWidget[] | null>(null); // non-null ⇒ editing
  const [picker, setPicker] = useState(false);
  const [saveAs, setSaveAs] = useState("");
  const editing = draft !== null;
  const widgets = draft ?? active?.widgets ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["layouts"] });
  const save = useMutation({
    mutationFn: (w: PlacedWidget[]) =>
      api(`/api/layouts/${active!.id}`, { method: "PUT", json: { widgets: w } }),
    onSuccess: () => {
      toast.success(`Saved "${active!.name}"`);
      setDraft(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const create = useMutation({
    mutationFn: (v: { name: string; widgets: PlacedWidget[] }) =>
      api<LayoutRow>("/api/layouts", { method: "POST", json: v }),
    onSuccess: (l) => {
      toast.success(`Created "${l.name}"`);
      setDraft(null);
      setSaveAs("");
      setActiveId(l.id);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/layouts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setActiveId(null);
      setDraft(null);
      invalidate();
    },
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) =>
      api(`/api/layouts/${id}`, { method: "PUT", json: { isDefault: true } }),
    onSuccess: invalidate,
  });

  const addWidget = (widgetId: string) => {
    const def = registry.widget(widgetId);
    const dim = SIZE_DIMENSIONS[def?.defaultSize ?? "md"];
    const y = Math.max(0, ...widgets.map((w) => w.y + w.h));
    setDraft([
      ...widgets,
      {
        i: `${widgetId.split(".")[1]}-${Date.now().toString(36)}`,
        widgetId,
        x: 0,
        y,
        w: dim.w,
        h: dim.h,
      },
    ]);
    setPicker(false);
    toast.success(`Added ${def?.title ?? "widget"} at the bottom`);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Command Home"
        title="Portfolio overview"
        description={
          editing
            ? "Drag widgets by their header, resize from the corner, then save."
            : "Your portfolio at a glance. Switch layouts or customize the grid."
        }
        actions={
          editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setPicker(true)}>
                <Plus /> Add widget
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                <RotateCcw /> Cancel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Save as…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2">
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (saveAs.trim()) create.mutate({ name: saveAs.trim(), widgets });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Input
                      value={saveAs}
                      onChange={(e) => setSaveAs(e.target.value)}
                      placeholder="New layout name"
                      className="h-8"
                      aria-label="New layout name"
                    />
                    <Button type="submit" size="sm" disabled={!saveAs.trim()}>
                      Save
                    </Button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                onClick={() => save.mutate(widgets)}
                disabled={save.isPending || !active}
              >
                <Save /> Save layout
              </Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Choose layout">
                    <LayoutGrid /> {active?.name ?? "Layout"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Saved layouts</DropdownMenuLabel>
                  {data?.map((l) => (
                    <DropdownMenuItem key={l.id} onSelect={() => setActiveId(l.id)}>
                      {l.id === active?.id ? <Check /> : <span className="size-4" />}
                      <span className="flex-1 truncate">{l.name}</span>
                      {l.isDefault && (
                        <Star className="text-muted-foreground size-3.5" aria-label="Default" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {active && !active.isDefault && (
                    <DropdownMenuItem onSelect={() => makeDefault.mutate(active.id)}>
                      <Star /> Make “{active.name}” the default
                    </DropdownMenuItem>
                  )}
                  {active && (data?.length ?? 0) > 1 && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => remove.mutate(active.id)}
                    >
                      <Trash2 /> Delete “{active.name}”
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={() => setDraft(active?.widgets ?? [])} disabled={!active}>
                Customize
              </Button>
            </>
          )
        }
      />
      <HomeKpis />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <Grid widgets={widgets} editing={editing} onChange={setDraft} />
      )}
      <WidgetPicker
        open={picker}
        onOpenChange={setPicker}
        onAdd={addWidget}
        placed={widgets.map((w) => w.widgetId)}
      />
    </PageContainer>
  );
}

function Grid({
  widgets,
  editing,
  onChange,
}: {
  widgets: PlacedWidget[];
  editing: boolean;
  onChange: (w: PlacedWidget[]) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const layout: Layout = useMemo(
    () => widgets.map((w) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: 3, minH: 4 })),
    [widgets],
  );
  const stacked = mounted && width < 768;

  if (!widgets.length)
    return (
      <div
        ref={containerRef}
        className="text-muted-foreground rounded-lg border border-dashed px-6 py-16 text-center text-sm"
      >
        This layout is empty. Click <strong>Customize</strong> → <strong>Add widget</strong>.
      </div>
    );

  return (
    <div
      ref={containerRef}
      className="-mx-2"
      data-testid="widget-grid"
      data-editing={editing ? "true" : "false"}
    >
      {stacked ? (
        <div className="grid grid-cols-1 gap-4 px-2">
          {[...widgets]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((w) => (
              <div key={w.i} style={{ height: 380 }}>
                <WidgetFrame
                  widgetId={w.widgetId}
                  w={w.w}
                  h={w.h}
                  editing={false}
                  fixedHeight={380 - 52}
                />
              </div>
            ))}
        </div>
      ) : (
        mounted && (
          <ReactGridLayout
            width={width}
            layout={layout}
            gridConfig={{
              cols: GRID_COLS,
              rowHeight: ROW_HEIGHT,
              margin: [GRID_MARGIN, GRID_MARGIN],
              containerPadding: [8, 0],
            }}
            dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: editing, handles: ["se"] }}
            compactor={verticalCompactor}
            onLayoutChange={(next) => {
              if (!editing) return;
              const map = new Map(next.map((l) => [l.i, l]));
              const updated = widgets.map((w) => {
                const l = map.get(w.i);
                return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
              });
              if (JSON.stringify(updated) !== JSON.stringify(widgets)) onChange(updated);
            }}
          >
            {widgets.map((w) => (
              <div key={w.i} data-testid={`widget-${w.i}`}>
                <WidgetFrame
                  widgetId={w.widgetId}
                  w={w.w}
                  h={w.h}
                  editing={editing}
                  onRemove={() => onChange(widgets.filter((x) => x.i !== w.i))}
                />
              </div>
            ))}
          </ReactGridLayout>
        )
      )}
    </div>
  );
}
