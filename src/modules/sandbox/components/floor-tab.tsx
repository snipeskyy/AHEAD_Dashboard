"use client";
import { Fan, Flame, Plus, Redo2, Server, Trash2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { RoomCalc } from "../lib/calc";
import { REDUNDANCY, type SandboxSpec, type SpecRack } from "../lib/spec";
import type { ComponentLibrary } from "../lib/types";
import { canPlace, FloorPlan, HEAT_LEGEND } from "./floor-plan";
import { RackPanel } from "./rack-panel";
import { newId } from "./use-scenario";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]";
type Sel = { kind: "rack" | "unit"; id: string } | null;

function NumField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <label className="text-muted-foreground grid gap-0.5 text-[11px]">
      {label}
      <Input
        type="number"
        step={step}
        className="h-8"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </label>
  );
}

/** Floor plan editor: toolbar (add, undo/redo, heat), plan, and a side panel for the selection or the room. */
export function FloorTab({
  spec,
  calc,
  lib,
  commit,
  preview,
  undo,
  redo,
  canUndo,
  canRedo,
  heat,
  setHeat,
  selected,
  setSelected,
}: {
  spec: SandboxSpec;
  calc: RoomCalc;
  lib: ComponentLibrary;
  commit: (s: SandboxSpec) => void;
  preview: (s: SandboxSpec) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  heat: boolean;
  setHeat: (v: boolean) => void;
  selected: Sel;
  setSelected: (s: Sel) => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  const addRack = () => {
    for (let y = 1; y + 2 <= spec.room.depthTiles; y += 3)
      for (let x = 2; x + 1 <= spec.room.widthTiles - 1; x++)
        if (canPlace(spec, "", x, y)) {
          const n = spec.racks.length + 1;
          const r: SpecRack = {
            id: newId("r"),
            label: `R${String(n).padStart(2, "0")}`,
            x,
            y,
            rotation: 0,
            heightU: 42,
            cooling: "air",
            feeds: 2,
            kwPerFeed: 17.3,
            devices: [],
          };
          commit({ ...spec, racks: [...spec.racks, r] });
          setSelected({ kind: "rack", id: r.id });
          setMsg(null);
          return;
        }
    setMsg("No free space for another rack. Enlarge the room or move racks.");
  };
  const addUnit = (kind: "crah" | "cdu") => {
    const id = newId("u");
    commit({
      ...spec,
      coolingUnits: [
        ...spec.coolingUnits,
        {
          id,
          label: `${kind === "cdu" ? "CDU" : "CRAH"}-${spec.coolingUnits.filter((u) => u.kind === kind).length + 1}`,
          kind,
          capacityKw: kind === "cdu" ? 200 : 100,
          x: 0,
          y: Math.min(spec.room.depthTiles - 1, spec.coolingUnits.length * 2),
        },
      ],
    });
    setSelected({ kind: "unit", id });
  };
  const rack = selected?.kind === "rack" ? spec.racks.find((r) => r.id === selected.id) : undefined;
  const unit =
    selected?.kind === "unit" ? spec.coolingUnits.find((u) => u.id === selected.id) : undefined;
  const setRoom = (p: Partial<SandboxSpec["room"]>) =>
    commit({ ...spec, room: { ...spec.room, ...p } });
  const setAssume = (p: Partial<SandboxSpec["assumptions"]>) =>
    commit({ ...spec, assumptions: { ...spec.assumptions, ...p } });

  return (
    <div className="grid gap-3">
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
        <Button size="sm" onClick={addRack}>
          <Server /> Add rack
        </Button>
        <Button size="sm" variant="outline" onClick={() => addUnit("crah")}>
          <Fan /> Add air handler
        </Button>
        <Button size="sm" variant="outline" onClick={() => addUnit("cdu")}>
          <Plus /> Add CDU
        </Button>
        <span className="bg-border mx-1 h-5 w-px" aria-hidden />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo2 />
        </Button>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          <Flame className="size-4" aria-hidden /> Heat overlay{" "}
          <Switch checked={heat} onCheckedChange={setHeat} aria-label="Heat overlay" />
        </label>
      </div>
      {msg && (
        <p className="text-warning-text text-xs" role="status">
          {msg}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-2">
          <FloorPlan
            spec={spec}
            calc={calc}
            selected={selected}
            onSelect={setSelected}
            onPreview={preview}
            onCommit={commit}
            heat={heat}
          />
          {heat && (
            <ul className="flex flex-wrap gap-3 text-xs" aria-label="Heat legend">
              {HEAT_LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1">
                  <span
                    className="inline-block size-3 rounded-sm border"
                    style={{ background: l.fill }}
                    aria-hidden
                  />
                  {l.label}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs">
            Grid = 0.6 m tiles. The thick edge on each rack is its front (cold aisle). Drag or use
            arrow keys; R rotates; Delete removes.
          </p>
        </div>
        <aside className="bg-card h-fit rounded-lg border p-4" aria-label="Selection">
          {rack ? (
            <>
              <h3 className="mb-2 text-sm font-semibold">Rack {rack.label}</h3>
              <RackPanel
                rack={rack}
                calc={calc.racks.find((r) => r.id === rack.id)}
                lib={lib}
                onChange={(r) =>
                  commit({ ...spec, racks: spec.racks.map((x) => (x.id === r.id ? r : x)) })
                }
              />
            </>
          ) : unit ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">{unit.label}</h3>
              <label className="text-muted-foreground grid gap-0.5 text-[11px]">
                Label
                <Input
                  className="h-8"
                  value={unit.label}
                  aria-label="Unit label"
                  onChange={(e) =>
                    commit({
                      ...spec,
                      coolingUnits: spec.coolingUnits.map((u) =>
                        u.id === unit.id ? { ...u, label: e.target.value || u.label } : u,
                      ),
                    })
                  }
                />
              </label>
              <NumField
                label="Capacity (kW)"
                value={unit.capacityKw}
                onChange={(n) =>
                  commit({
                    ...spec,
                    coolingUnits: spec.coolingUnits.map((u) =>
                      u.id === unit.id ? { ...u, capacityKw: n } : u,
                    ),
                  })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  label="X (tile)"
                  value={unit.x}
                  onChange={(n) =>
                    commit({
                      ...spec,
                      coolingUnits: spec.coolingUnits.map((u) =>
                        u.id === unit.id
                          ? { ...u, x: Math.max(0, Math.min(spec.room.widthTiles - 2, n)) }
                          : u,
                      ),
                    })
                  }
                />
                <NumField
                  label="Y (tile)"
                  value={unit.y}
                  onChange={(n) =>
                    commit({
                      ...spec,
                      coolingUnits: spec.coolingUnits.map((u) =>
                        u.id === unit.id
                          ? { ...u, y: Math.max(0, Math.min(spec.room.depthTiles - 1, n)) }
                          : u,
                      ),
                    })
                  }
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="w-fit"
                onClick={() => {
                  commit({
                    ...spec,
                    coolingUnits: spec.coolingUnits.filter((u) => u.id !== unit.id),
                  });
                  setSelected(null);
                }}
              >
                <Trash2 /> Remove unit
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold">Room & assumptions</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField
                  label="Width (tiles)"
                  value={spec.room.widthTiles}
                  onChange={(n) => setRoom({ widthTiles: Math.max(4, n) })}
                />
                <NumField
                  label="Depth (tiles)"
                  value={spec.room.depthTiles}
                  onChange={(n) => setRoom({ depthTiles: Math.max(4, n) })}
                />
                <NumField
                  label="UPS capacity (kW)"
                  value={spec.room.upsCapacityKw}
                  onChange={(n) => setRoom({ upsCapacityKw: n })}
                />
                <NumField
                  label="Floor rating (kg/m²)"
                  value={spec.room.maxFloorLoadKgM2}
                  onChange={(n) => setRoom({ maxFloorLoadKgM2: n })}
                />
                <label className="text-muted-foreground grid gap-0.5 text-[11px]">
                  Cooling redundancy
                  <select
                    className={sel}
                    value={spec.room.coolingRedundancy}
                    aria-label="Cooling redundancy"
                    onChange={(e) =>
                      setRoom({
                        coolingRedundancy: e.target
                          .value as SandboxSpec["room"]["coolingRedundancy"],
                      })
                    }
                  >
                    {REDUNDANCY.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <NumField
                  label="Air ceiling per rack (kW)"
                  value={spec.assumptions.airKwPerRack}
                  onChange={(n) => setAssume({ airKwPerRack: Math.max(1, n) })}
                />
                <NumField
                  label="Default utilization (%)"
                  value={Math.round(spec.assumptions.utilization * 100)}
                  onChange={(n) => setAssume({ utilization: Math.min(1, Math.max(0, n / 100)) })}
                />
                <NumField
                  label="Load growth (%/yr)"
                  value={spec.assumptions.growthPctPerYear}
                  onChange={(n) => setAssume({ growthPctPerYear: n })}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Select a rack or cooling unit on the plan to edit it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
