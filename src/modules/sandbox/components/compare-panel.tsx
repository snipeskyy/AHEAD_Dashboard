"use client";
import { useMemo } from "react";
import { growth, roomCalc } from "../lib/calc";
import type { SandboxSpec } from "../lib/spec";
import type { ComponentLibrary } from "../lib/types";

/** Before (the scenario this what-if was copied from) vs after (this one), side by side. */
export function ComparePanel({
  beforeName,
  before,
  after,
  lib,
}: {
  beforeName: string;
  before: SandboxSpec;
  after: SandboxSpec;
  lib: ComponentLibrary;
}) {
  const rows = useMemo(() => {
    const a = roomCalc(before, lib),
      b = roomCalc(after, lib);
    const ga = growth(before, lib),
      gb = growth(after, lib);
    const crit = (x: typeof a) => x.issues.filter((i) => i.severity === "critical").length;
    const yrs = (y: number | null) =>
      y === null ? "beyond horizon" : y === 0 ? "now" : `${y.toFixed(1)} yrs`;
    const n = (x: number, d = 1) => x.toFixed(d);
    return [
      ["Racks", String(before.racks.length), String(after.racks.length)],
      ["IT load (kW)", n(a.drawKw), n(b.drawKw)],
      ["Nameplate (kW)", n(a.maxKw), n(b.maxKw)],
      ["Heat to air (kW)", n(a.airKw), n(b.airKw)],
      ["Heat to liquid (kW)", n(a.liquidKw), n(b.liquidKw)],
      ["PUE (estimate)", a.pue ? n(a.pue, 2) : "—", b.pue ? n(b.pue, 2) : "—"],
      [
        "Rack units used",
        `${Math.round(a.uUtilization * 100)}%`,
        `${Math.round(b.uUtilization * 100)}%`,
      ],
      ["Growth runway", yrs(ga.yearsLeft), yrs(gb.yearsLeft)],
      ["Critical issues", String(crit(a)), String(crit(b))],
    ];
  }, [before, after, lib]);
  return (
    <div
      className="bg-card overflow-x-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label="Before and after comparison"
    >
      <table className="w-full text-[13px]">
        <thead className="text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="px-4 py-2 font-medium">Measure</th>
            <th className="px-3 font-medium">Before · {beforeName}</th>
            <th className="px-3 font-medium">After · this what-if</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(([k, a, b]) => (
            <tr key={k}>
              <td className="px-4 py-1.5">{k}</td>
              <td className="tabular px-3">{a}</td>
              <td className={`tabular px-3 ${a !== b ? "font-semibold" : ""}`}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
