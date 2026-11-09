"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RackCalc } from "../lib/calc";
import type { ComponentLibrary } from "../lib/types";
import { COOLING_TYPES, type SpecRack } from "../lib/spec";
import { CATEGORY_STYLE } from "./rack-elevation";
import { newId } from "./use-scenario";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]";
const U = 12;

/** First free position (from the top) where a device of `h` U fits. */
export function freeSlot(rack: SpecRack, lib: ComponentLibrary, h: number): number | null {
  const used = new Set<number>();
  for (const d of rack.devices) {
    const p = lib.get(d.profileId);
    for (let u = d.position; u < d.position + (p?.heightU ?? 0); u++) used.add(u);
  }
  if (h === 0) return 1;
  for (let top = rack.heightU; top - h + 1 >= 1; top--) {
    let ok = true;
    for (let u = top - h + 1; u <= top; u++) if (used.has(u)) ok = false;
    if (ok) return top - h + 1;
  }
  return null;
}

/** Rack settings + interactive elevation (front view). */
export function RackPanel({
  rack,
  calc,
  lib,
  onChange,
}: {
  rack: SpecRack;
  calc: RackCalc | undefined;
  lib: ComponentLibrary;
  onChange: (r: SpecRack) => void;
}) {
  const [profile, setProfile] = useState(lib.profiles[0].id);
  const [focus, setFocus] = useState<string | null>(null);
  const add = () => {
    const p = lib.get(profile)!;
    const pos = freeSlot(rack, lib, p.heightU);
    if (pos === null) return;
    onChange({
      ...rack,
      devices: [...rack.devices, { id: newId("d"), profileId: p.id, position: pos }],
    });
  };
  const move = (id: string, dir: 1 | -1) =>
    onChange({
      ...rack,
      devices: rack.devices.map((d) =>
        d.id === id ? { ...d, position: Math.max(1, d.position + dir) } : d,
      ),
    });
  const h = rack.heightU * U;
  const addable = freeSlot(rack, lib, lib.get(profile)!.heightU) !== null;
  return (
    <div className="grid gap-3 text-[13px]" aria-label={`Rack ${rack.label}`}>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-muted-foreground col-span-2 grid gap-0.5 text-[11px]">
          Label
          <Input
            className="h-8"
            value={rack.label}
            aria-label="Rack label"
            onChange={(e) => onChange({ ...rack, label: e.target.value || rack.label })}
          />
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Height
          <select
            className={sel}
            value={rack.heightU}
            aria-label="Rack height"
            onChange={(e) => onChange({ ...rack, heightU: Number(e.target.value) })}
          >
            {[42, 45, 48, 52].map((u) => (
              <option key={u} value={u}>
                {u}U
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Cooling
          <select
            className={sel}
            value={rack.cooling}
            aria-label="Rack cooling"
            onChange={(e) => onChange({ ...rack, cooling: e.target.value as SpecRack["cooling"] })}
          >
            {COOLING_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Feeds
          <select
            className={sel}
            value={rack.feeds}
            aria-label="Power feeds"
            onChange={(e) => onChange({ ...rack, feeds: Number(e.target.value) })}
          >
            <option value={2}>A + B (2N)</option>
            <option value={1}>Single</option>
          </select>
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          kW per feed
          <Input
            type="number"
            step="0.1"
            className="h-8"
            value={rack.kwPerFeed}
            aria-label="kW per feed"
            onChange={(e) => onChange({ ...rack, kwPerFeed: Number(e.target.value || 0) })}
          />
        </label>
      </div>
      {calc && (
        <dl
          className="bg-muted/40 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md p-2 text-xs"
          aria-label="Rack totals"
        >
          <div>
            <dt className="text-muted-foreground">Draw</dt>
            <dd className="tabular font-medium">{calc.drawKw.toFixed(1)} kW</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nameplate</dt>
            <dd className="tabular font-medium">{calc.maxKw.toFixed(1)} kW</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Feed load</dt>
            <dd className="tabular font-medium">{Math.round(calc.feedLoad * 100)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">To air / liquid</dt>
            <dd className="tabular font-medium">
              {calc.airKw.toFixed(1)} / {calc.liquidKw.toFixed(1)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Space</dt>
            <dd className="tabular font-medium">
              {calc.usedU}/{rack.heightU}U
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Floor</dt>
            <dd className="tabular font-medium">{Math.round(calc.floorLoadKgM2)} kg/m²</dd>
          </div>
        </dl>
      )}
      <div className="flex gap-2">
        <select
          className={`${sel} min-w-0 flex-1`}
          value={profile}
          aria-label="Device to add"
          onChange={(e) => setProfile(e.target.value)}
        >
          {lib.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} · {p.heightU}U · {p.maxKw} kW
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={add} disabled={!addable}>
          <Plus /> Add
        </Button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <svg
          viewBox={`0 0 140 ${h + 4}`}
          width={140}
          role="img"
          aria-label={`${rack.label} elevation: ${rack.devices.length} devices`}
        >
          <rect
            x={1}
            y={1}
            width={138}
            height={h + 2}
            fill="var(--card)"
            stroke="var(--foreground)"
          />
          {rack.devices.map((d) => {
            const p = lib.get(d.profileId);
            if (!p || !p.heightU) return null;
            const y = (rack.heightU - (d.position + p.heightU - 1)) * U + 2;
            return (
              <g key={d.id}>
                <rect
                  x={8}
                  y={y + 0.5}
                  width={124}
                  height={p.heightU * U - 1}
                  rx={1.5}
                  fill={`var(--series-${CATEGORY_STYLE[p.category].series})`}
                  fillOpacity={focus === d.id ? 0.9 : 0.55}
                  stroke="var(--foreground)"
                  strokeWidth={0.5}
                />
                {p.heightU * U >= 10 && (
                  <text
                    x={70}
                    y={y + Math.min(p.heightU * U, 14) - 3}
                    textAnchor="middle"
                    fontSize="8"
                    fill="var(--foreground)"
                  >
                    {p.label.split(" (")[0]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <ul className="grid content-start gap-1 text-xs" aria-label="Devices">
          {[...rack.devices]
            .sort((a, b) => b.position - a.position)
            .map((d) => {
              const p = lib.get(d.profileId);
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-1"
                  onMouseEnter={() => setFocus(d.id)}
                  onMouseLeave={() => setFocus(null)}
                >
                  <span className="tabular text-muted-foreground w-8">U{d.position}</span>
                  <span className="min-w-0 flex-1 truncate" title={p?.note}>
                    {p?.label ?? d.profileId}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${p?.label} up`}
                    onClick={() => move(d.id, 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${p?.label} down`}
                    onClick={() => move(d.id, -1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove ${p?.label}`}
                    onClick={() =>
                      onChange({ ...rack, devices: rack.devices.filter((x) => x.id !== d.id) })
                    }
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          {!rack.devices.length && (
            <li className="text-muted-foreground">Empty rack. Add devices above.</li>
          )}
        </ul>
      </div>
      {calc && calc.issues.length > 0 && (
        <ul className="grid gap-1 text-xs" aria-label="Rack issues">
          {calc.issues.map((i, n) => (
            <li
              key={n}
              className={
                i.severity === "critical"
                  ? "text-critical-text"
                  : i.severity === "warning"
                    ? "text-warning-text"
                    : "text-muted-foreground"
              }
            >
              <span className="font-medium uppercase">{i.severity}</span> · {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
