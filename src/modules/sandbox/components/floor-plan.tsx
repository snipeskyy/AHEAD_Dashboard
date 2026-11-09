"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { rackLimitKw, type RoomCalc } from "../lib/calc";
import type { SandboxSpec, SpecRack } from "../lib/spec";

const T = 34; // px per 0.6 m tile
type Sel = { kind: "rack" | "unit"; id: string } | null;

/** Heat band per rack (kW vs the limit for its cooling type); color + text label, never color alone. */
export function heatBand(kw: number, ceiling: number) {
  const r = kw / Math.max(1, ceiling);
  return r === 0
    ? { i: 0, label: "empty" }
    : r < 0.5
      ? { i: 1, label: "low" }
      : r < 0.85
        ? { i: 2, label: "medium" }
        : r <= 1
          ? { i: 3, label: "high" }
          : { i: 4, label: "over limit" };
}
const BAND_FILL = [
  "var(--muted)",
  "var(--seq-250)",
  "var(--seq-400)",
  "var(--seq-550)",
  "var(--status-critical)",
];

const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (r: Pick<SpecRack, "x" | "y">) => ({ x: r.x, y: r.y, w: 1, h: 2 });
const unitBox = (u: { x: number; y: number }) => ({ x: u.x, y: u.y, w: 2, h: 1 });

/** Can a rack sit at (x, y)? Inside the room and not on another rack or cooling unit. */
export function canPlace(spec: SandboxSpec, id: string, x: number, y: number) {
  if (x < 0 || y < 0 || x + 1 > spec.room.widthTiles || y + 2 > spec.room.depthTiles) return false;
  const b = { x, y, w: 1, h: 2 };
  return (
    !spec.racks.some((r) => r.id !== id && overlaps(b, box(r))) &&
    !spec.coolingUnits.some((u) => overlaps(b, unitBox(u)))
  );
}

/** Interactive floor plan: click to select, drag (snaps to 0.6 m tiles) or arrow keys to move, R rotates, Delete removes. */
export function FloorPlan({
  spec,
  calc,
  selected,
  onSelect,
  onPreview,
  onCommit,
  heat,
}: {
  spec: SandboxSpec;
  calc: RoomCalc;
  selected: Sel;
  onSelect: (s: Sel) => void;
  onPreview: (s: SandboxSpec) => void;
  onCommit: (s: SandboxSpec) => void;
  heat: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    start: SandboxSpec;
    dx: number;
    dy: number;
  } | null>(null);
  const W = spec.room.widthTiles * T;
  const H = spec.room.depthTiles * T;
  const byId = new Map(calc.racks.map((r) => [r.id, r]));
  const tileAt = (e: PointerEvent) => {
    const pt = svg.current!.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: Math.floor(p.x / T), y: Math.floor(p.y / T) };
  };
  const moveRack = (s: SandboxSpec, id: string, x: number, y: number): SandboxSpec => ({
    ...s,
    racks: s.racks.map((r) => (r.id === id ? { ...r, x, y } : r)),
  });

  const onDown = (e: PointerEvent, r: SpecRack) => {
    onSelect({ kind: "rack", id: r.id });
    const t = tileAt(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ id: r.id, start: spec, dx: t.x - r.x, dy: t.y - r.y });
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const t = tileAt(e);
    const x = t.x - drag.dx,
      y = t.y - drag.dy;
    const cur = spec.racks.find((r) => r.id === drag.id)!;
    if ((x !== cur.x || y !== cur.y) && canPlace(spec, drag.id, x, y))
      onPreview(moveRack(spec, drag.id, x, y));
  };
  const onUp = () => {
    if (!drag) return;
    const before = drag.start.racks.find((r) => r.id === drag.id)!;
    const after = spec.racks.find((r) => r.id === drag.id)!;
    setDrag(null);
    if (before.x !== after.x || before.y !== after.y) {
      onPreview(drag.start);
      onCommit(spec);
    }
  };
  const onKey = (e: KeyboardEvent, r: SpecRack) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (d) {
      e.preventDefault();
      if (canPlace(spec, r.id, r.x + d[0], r.y + d[1]))
        onCommit(moveRack(spec, r.id, r.x + d[0], r.y + d[1]));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      onCommit({ ...spec, racks: spec.racks.filter((x) => x.id !== r.id) });
      onSelect(null);
    } else if (e.key.toLowerCase() === "r")
      onCommit({
        ...spec,
        racks: spec.racks.map((x) =>
          x.id === r.id ? { ...x, rotation: x.rotation === 0 ? 180 : 0 } : x,
        ),
      });
  };

  return (
    <div className="overflow-auto rounded-md border bg-[var(--card)]" tabIndex={-1}>
      <svg
        ref={svg}
        viewBox={`-8 -8 ${W + 16} ${H + 16}`}
        width={W + 16}
        className="max-w-none select-none"
        role="group"
        aria-label={`Floor plan: ${spec.room.label}, ${(spec.room.widthTiles * 0.6).toFixed(1)} × ${(spec.room.depthTiles * 0.6).toFixed(1)} m`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerDown={(e) => e.target === svg.current && onSelect(null)}
      >
        <defs>
          <pattern id="tiles" width={T} height={T} patternUnits="userSpaceOnUse">
            <path d={`M ${T} 0 L 0 0 0 ${T}`} fill="none" stroke="var(--border)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="url(#tiles)"
          stroke="var(--foreground)"
          strokeWidth="2"
          rx="2"
        />
        {spec.coolingUnits.map((u) => {
          const sel = selected?.kind === "unit" && selected.id === u.id;
          return (
            <g
              key={u.id}
              transform={`translate(${u.x * T},${u.y * T})`}
              onClick={() => onSelect({ kind: "unit", id: u.id })}
              role="button"
              tabIndex={0}
              aria-label={`${u.label}: ${u.kind.toUpperCase()} ${u.capacityKw} kW`}
              onKeyDown={(e) => e.key === "Enter" && onSelect({ kind: "unit", id: u.id })}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--ring)]"
            >
              <rect
                width={2 * T - 2}
                height={T - 2}
                x={1}
                y={1}
                rx={3}
                fill={u.kind === "cdu" ? "var(--series-7)" : "var(--series-3)"}
                fillOpacity={0.18}
                stroke={
                  sel ? "var(--ring)" : u.kind === "cdu" ? "var(--series-7)" : "var(--series-3)"
                }
                strokeWidth={sel ? 3 : 1.5}
              />
              <text x={T} y={T / 2 + 4} textAnchor="middle" fontSize="10" fill="var(--foreground)">
                {u.label}
              </text>
            </g>
          );
        })}
        {spec.racks.map((r) => {
          const c = byId.get(r.id);
          const band = heatBand(c?.drawKw ?? 0, rackLimitKw(r, spec.assumptions.airKwPerRack));
          const critical = c?.issues.some((i) => i.severity === "critical");
          const sel = selected?.kind === "rack" && selected.id === r.id;
          return (
            <g
              key={r.id}
              transform={`translate(${r.x * T},${r.y * T})`}
              role="button"
              tabIndex={0}
              aria-label={`${r.label}: ${(c?.drawKw ?? 0).toFixed(1)} kW (${band.label})${critical ? ", has critical issues" : ""}. Arrow keys move, R rotates, Delete removes.`}
              aria-pressed={sel}
              onPointerDown={(e) => onDown(e, r)}
              onKeyDown={(e) => onKey(e, r)}
              onFocus={() => onSelect({ kind: "rack", id: r.id })}
              className="cursor-grab outline-none [&:focus-visible>rect]:stroke-[var(--ring)]"
            >
              <rect
                x={1}
                y={1}
                width={T - 2}
                height={2 * T - 2}
                rx={2}
                fill={heat ? BAND_FILL[band.i] : "var(--secondary)"}
                stroke={
                  sel ? "var(--ring)" : critical ? "var(--status-critical)" : "var(--foreground)"
                }
                strokeWidth={sel ? 3 : critical ? 2.5 : 1}
              />
              <line
                x1={3}
                x2={T - 3}
                y1={r.rotation === 0 ? 2 * T - 4 : 4}
                y2={r.rotation === 0 ? 2 * T - 4 : 4}
                stroke="var(--foreground)"
                strokeWidth={2}
              />
              <text
                x={T / 2}
                y={T}
                textAnchor="middle"
                fontSize="9"
                fill="var(--foreground)"
                transform={`rotate(-90 ${T / 2} ${T})`}
              >
                {r.label}
              </text>
              {critical && (
                <text
                  x={T - 8}
                  y={11}
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--status-critical)"
                  aria-hidden
                >
                  !
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const HEAT_LEGEND = ["empty", "low", "medium", "high", "over limit"].map((label, i) => ({
  label,
  fill: BAND_FILL[i],
}));
