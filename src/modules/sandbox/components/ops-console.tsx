"use client";
import { Activity, AlertTriangle, Pause, Play, Thermometer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { telemetry } from "../lib/calc";
import type { SandboxSpec } from "../lib/spec";
import type { ComponentLibrary } from "../lib/types";

/** ASHRAE-recommended inlet upper bound (°C); above it is shown as a warning. */
const INLET_WARN_C = 27;

/** Simulated operations console: deterministic fake telemetry so customers can picture day-2 operations. */
export function OpsConsole({ spec, lib }: { spec: SandboxSpec; lib: ComponentLibrary }) {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 1500);
    return () => clearInterval(t);
  }, [running]);
  const rows = useMemo(() => telemetry(spec, lib, tick), [spec, lib, tick]);
  const total = rows.reduce((s, r) => s + r.kw, 0);
  const hot = rows.filter((r) => r.inletC > INLET_WARN_C);
  return (
    <section className="grid gap-3" aria-label="Operations console (simulated)">
      <div
        className="bg-muted text-foreground flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-[13px]"
        role="note"
      >
        <AlertTriangle className="text-warning-text size-4" aria-hidden /> Simulated telemetry for
        illustration. No real systems are connected or read.
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7"
          onClick={() => setRunning(!running)}
          aria-pressed={!running}
        >
          {running ? (
            <>
              <Pause /> Pause
            </>
          ) : (
            <>
              <Play /> Resume
            </>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">IT load (live)</div>
          <div className="tabular text-xl font-semibold">{total.toFixed(1)} kW</div>
        </div>
        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Racks reporting</div>
          <div className="tabular text-xl font-semibold">{rows.length}</div>
        </div>
        <div className="bg-card rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Inlet over {INLET_WARN_C} °C</div>
          <div className={`tabular text-xl font-semibold ${hot.length ? "text-warning-text" : ""}`}>
            {hot.length}
          </div>
        </div>
      </div>
      <div
        className="bg-card overflow-x-auto rounded-lg border"
        tabIndex={0}
        role="region"
        aria-label="Rack telemetry"
      >
        <table className="w-full text-[13px]">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-3 py-1.5 font-medium">Rack</th>
              <th className="px-2 font-medium">Power</th>
              <th className="px-2 font-medium">Utilization</th>
              <th className="px-2 font-medium">Inlet</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 font-medium">
                  <Activity className="text-muted-foreground mr-1 inline size-3.5" aria-hidden />
                  {r.label}
                </td>
                <td className="tabular px-2">{r.kw.toFixed(2)} kW</td>
                <td className="px-2">
                  <div className="bg-muted h-2 w-32 rounded" aria-hidden>
                    <div
                      className="h-2 rounded bg-[var(--series-1)]"
                      style={{ width: `${Math.min(100, r.util * 100)}%` }}
                    />
                  </div>
                  <span className="sr-only">{Math.round(r.util * 100)}%</span>
                </td>
                <td
                  className={`tabular px-2 ${r.inletC > INLET_WARN_C ? "text-warning-text" : ""}`}
                >
                  <Thermometer className="mr-1 inline size-3.5" aria-hidden />
                  {r.inletC.toFixed(1)} °C{r.inletC > INLET_WARN_C ? " (high)" : ""}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-3 py-4 text-xs">
                  Add racks to see simulated telemetry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
