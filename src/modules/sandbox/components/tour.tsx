"use client";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { failures, growth, roomCalc } from "../lib/calc";
import type { SandboxSpec } from "../lib/spec";
import type { ComponentLibrary } from "../lib/types";
import { CapacityTiles } from "./capacity-panel";
import { ThreeView, type CameraPreset } from "./three-view";

interface Step {
  title: string;
  caption: string;
  view: "3d" | "tiles";
  preset?: CameraPreset;
  heat?: boolean;
}

/** Guided, full-screen customer tour. Every caption is computed from the scenario (nothing invented). */
export function Tour({
  name,
  spec,
  lib,
  onClose,
}: {
  name: string;
  spec: SandboxSpec;
  lib: ComponentLibrary;
  onClose: () => void;
}) {
  const c = useMemo(() => roomCalc(spec, lib), [spec, lib]);
  const g = useMemo(() => growth(spec, lib), [spec, lib]);
  const f = useMemo(() => failures(spec, lib), [spec, lib]);
  const liquidShare = c.drawKw ? Math.round((c.liquidKw / c.drawKw) * 100) : 0;
  const holds = f.cooling.filter((x) => x.ok).length;
  const steps: Step[] = [
    {
      title: name,
      view: "3d",
      preset: "overview",
      caption: `${spec.room.label}: ${(spec.room.widthTiles * 0.6).toFixed(1)} × ${(spec.room.depthTiles * 0.6).toFixed(1)} m with ${spec.racks.length} racks and ${spec.coolingUnits.length} cooling units.`,
    },
    {
      title: "Walk the aisle",
      view: "3d",
      preset: "aisle",
      heat: true,
      caption: `Racks colored by heat. ${c.drawKw.toFixed(0)} kW of IT load; ${liquidShare}% of the heat goes to liquid cooling, the rest to air.`,
    },
    {
      title: "Capacity at a glance",
      view: "tiles",
      caption: `UPS ${Math.round((c.drawKw / Math.max(1, c.upsCapacityKw)) * 100)}% used · estimated PUE ${c.pue ? c.pue.toFixed(2) : "—"} · ${Math.round(c.whitespaceUtilization * 100)}% of floor space used.`,
    },
    {
      title: "Room to grow",
      view: "3d",
      preset: "overview",
      heat: true,
      caption:
        g.yearsLeft === null
          ? `At ${spec.assumptions.growthPctPerYear}%/yr growth, capacity holds beyond the ${spec.assumptions.horizonYears}-year projection.`
          : g.yearsLeft === 0
            ? `Today's load already reaches the ${g.binding.label.toLowerCase()} limit.`
            : `At ${spec.assumptions.growthPctPerYear}%/yr growth, the ${g.binding.label.toLowerCase()} limit is reached in about ${g.yearsLeft.toFixed(1)} years.`,
    },
    {
      title: "Built to keep running",
      view: "3d",
      preset: "rack",
      heat: true,
      caption: `${spec.room.coolingRedundancy} cooling: the room holds with any one of ${f.cooling.length} units offline in ${holds} of ${f.cooling.length} cases. ${f.feedA.filter((x) => x.status === "ok").length} of ${f.feedA.length} racks keep running if power feed A fails.`,
    },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setI((x) => Math.min(steps.length - 1, x + 1));
      } else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);
  const s = steps[i];
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${i + 1} of ${steps.length}: ${s.title}`}
      className="bg-background fixed inset-0 z-[100] grid grid-rows-[auto_1fr_auto] gap-3 p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-primary text-xs font-semibold tracking-wide uppercase">
            Step {i + 1} of {steps.length}
          </div>
          <h2 className="text-2xl font-semibold">{s.title}</h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-base" aria-live="polite">
            {s.caption}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          <X /> Exit tour (Esc)
        </Button>
      </div>
      <div className="min-h-0">
        {s.view === "3d" ? (
          <ThreeView
            spec={spec}
            calc={c}
            heat={!!s.heat}
            preset={s.preset ?? "overview"}
            selectedId={null}
            onSelect={() => undefined}
          />
        ) : (
          <CapacityTiles c={c} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          Illustrative planning model, not vendor-certified engineering.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
            <ChevronLeft /> Back
          </Button>
          {i < steps.length - 1 ? (
            <Button onClick={() => setI(i + 1)}>
              Next <ChevronRight />
            </Button>
          ) : (
            <Button onClick={onClose}>Finish</Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
