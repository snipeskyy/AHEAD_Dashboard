import type { ComponentLibrary, DeviceProfile } from "./types";
import {
  RACK_FOOTPRINT_M2,
  TILE_M,
  type CoolingUnit,
  type SandboxSpec,
  type SpecRack,
} from "./spec";

/**
 * Explainable capacity calculator (Phase 12). Pure: same spec in → same numbers out. Planning-grade,
 * illustrative figures; every result carries the formula used.
 */
export const BTU_PER_KW = 3412;
export const RACK_EMPTY_KG = 140;
/** Heat a rack can reject by cooling type (kW per rack) before a warning. Air uses the scenario's ceiling. */
export const RACK_COOLING_LIMIT_KW = {
  "rear-door-hx": 35,
  "direct-liquid": 100,
  immersion: 150,
} as const;
/** Fraction of a direct-liquid device's heat that goes to the liquid loop. */
export const DLC_LIQUID_FRACTION = 0.8;
const IDLE = 0.3; // draw at 0% utilization, as a share of max

export type Severity = "critical" | "warning" | "info";
export interface Issue {
  severity: Severity;
  message: string;
  rackId?: string;
}

/** The heat a rack can reject for its cooling type (air uses the scenario's ceiling). */
export const rackLimitKw = (r: Pick<SpecRack, "cooling">, airKwPerRack: number) =>
  r.cooling === "air" ? airKwPerRack : RACK_COOLING_LIMIT_KW[r.cooling];

export const deviceDrawKw = (p: DeviceProfile, util: number) =>
  p.maxKw * (IDLE + (1 - IDLE) * util);

export interface RackCalc {
  id: string;
  label: string;
  usedU: number;
  freeU: number;
  drawKw: number;
  maxKw: number;
  airKw: number;
  liquidKw: number;
  heatBtuHr: number;
  weightKg: number;
  floorLoadKgM2: number;
  feedCapacityKw: number;
  /** maxKw / feed capacity. */
  feedLoad: number;
  issues: Issue[];
}

export function rackCalc(
  r: SpecRack,
  lib: ComponentLibrary,
  spec: Pick<SandboxSpec, "assumptions" | "room">,
): RackCalc {
  const issues: Issue[] = [];
  const occupied = new Map<number, string>();
  let drawKw = 0,
    maxKw = 0,
    liquidKw = 0,
    weightKg = RACK_EMPTY_KG,
    usedU = 0;
  for (const d of r.devices) {
    const p = lib.get(d.profileId);
    if (!p) {
      issues.push({
        severity: "warning",
        message: `Unknown device “${d.profileId}”`,
        rackId: r.id,
      });
      continue;
    }
    const top = d.position + p.heightU - 1;
    if (p.heightU && top > r.heightU)
      issues.push({
        severity: "critical",
        message: `${p.label} at U${d.position} doesn't fit in ${r.heightU}U`,
        rackId: r.id,
      });
    for (let u = d.position; u <= top; u++) {
      if (occupied.has(u))
        issues.push({
          severity: "critical",
          message: `U${u} is used twice (${occupied.get(u)} and ${p.label})`,
          rackId: r.id,
        });
      occupied.set(u, p.label);
    }
    usedU += p.heightU;
    const draw = deviceDrawKw(p, d.utilization ?? spec.assumptions.utilization);
    drawKw += draw;
    maxKw += p.maxKw;
    weightKg += p.weightKg;
    if (r.cooling === "immersion") liquidKw += draw;
    else if (p.cooling === "direct-liquid") liquidKw += draw * DLC_LIQUID_FRACTION;
  }
  // Rear-door heat exchangers remove heat at the rack (to facility water) up to their rating.
  if (r.cooling === "rear-door-hx")
    liquidKw = Math.min(drawKw, RACK_COOLING_LIMIT_KW["rear-door-hx"]);
  const airKw = Math.max(0, drawKw - liquidKw);
  const limit =
    r.cooling === "air" ? spec.assumptions.airKwPerRack : RACK_COOLING_LIMIT_KW[r.cooling];
  if (r.cooling === "air" && drawKw > limit)
    issues.push({
      severity: "critical",
      message: `${r.label}: ${drawKw.toFixed(1)} kW exceeds the ${limit} kW air-cooling ceiling; consider rear-door or liquid cooling`,
      rackId: r.id,
    });
  else if (r.cooling !== "air" && drawKw > limit)
    issues.push({
      severity: "critical",
      message: `${r.label}: ${drawKw.toFixed(1)} kW exceeds the ${limit} kW limit for ${r.cooling}`,
      rackId: r.id,
    });
  if (r.cooling !== "air" && airKw > spec.assumptions.airKwPerRack)
    issues.push({
      severity: "warning",
      message: `${r.label}: residual ${airKw.toFixed(1)} kW to air is above the air ceiling`,
      rackId: r.id,
    });
  if (
    r.cooling === "direct-liquid" &&
    !r.devices.some((d) => lib.get(d.profileId)?.cooling === "direct-liquid")
  )
    issues.push({
      severity: "info",
      message: `${r.label} is set to direct liquid but has no liquid-cooled devices`,
      rackId: r.id,
    });
  const feedCapacityKw = r.kwPerFeed;
  const feedLoad = feedCapacityKw ? maxKw / feedCapacityKw : maxKw ? Infinity : 0;
  if (feedLoad > 1)
    issues.push({
      severity: "critical",
      message: `${r.label}: nameplate ${maxKw.toFixed(1)} kW exceeds the ${feedCapacityKw} kW feed${r.feeds === 2 ? " (each of A/B must carry it alone)" : ""}`,
      rackId: r.id,
    });
  else if (feedLoad > 0.8)
    issues.push({
      severity: "warning",
      message: `${r.label}: feed ${Math.round(feedLoad * 100)}% loaded at nameplate`,
      rackId: r.id,
    });
  if (r.feeds === 1 && drawKw > 0)
    issues.push({
      severity: "info",
      message: `${r.label} has a single power feed (no A/B redundancy)`,
      rackId: r.id,
    });
  const floorLoadKgM2 = weightKg / RACK_FOOTPRINT_M2;
  if (floorLoadKgM2 > spec.room.maxFloorLoadKgM2)
    issues.push({
      severity: "critical",
      message: `${r.label}: ${Math.round(floorLoadKgM2)} kg/m² exceeds the ${spec.room.maxFloorLoadKgM2} kg/m² floor rating`,
      rackId: r.id,
    });
  return {
    id: r.id,
    label: r.label,
    usedU,
    freeU: r.heightU - usedU,
    drawKw,
    maxKw,
    airKw,
    liquidKw,
    heatBtuHr: drawKw * BTU_PER_KW,
    weightKg,
    floorLoadKgM2,
    feedCapacityKw,
    feedLoad,
    issues,
  };
}

/** Capacity after redundancy: N = all units, N+1 = minus the largest, 2N = half. */
export function effectiveCapacity(
  units: CoolingUnit[],
  redundancy: SandboxSpec["room"]["coolingRedundancy"],
) {
  const total = units.reduce((s, u) => s + u.capacityKw, 0);
  if (redundancy === "2N") return total / 2;
  if (redundancy === "N+1")
    return Math.max(0, total - Math.max(0, ...units.map((u) => u.capacityKw)));
  return total;
}

export interface RoomCalc {
  racks: RackCalc[];
  drawKw: number;
  maxKw: number;
  airKw: number;
  liquidKw: number;
  airCapacityKw: number;
  liquidCapacityKw: number;
  upsCapacityKw: number;
  pue: number;
  areaM2: number;
  whitespaceUtilization: number;
  uUtilization: number;
  issues: Issue[];
  formulas: string[];
}

const COP_AIR = 3;
const COP_LIQUID = 8;

export function roomCalc(
  spec: SandboxSpec,
  lib: ComponentLibrary,
  units: CoolingUnit[] = spec.coolingUnits,
): RoomCalc {
  const racks = spec.racks.map((r) => rackCalc(r, lib, spec));
  const sum = (k: keyof RackCalc) => racks.reduce((s, r) => s + (r[k] as number), 0);
  const drawKw = sum("drawKw"),
    maxKw = sum("maxKw"),
    airKw = sum("airKw"),
    liquidKw = sum("liquidKw");
  const red = spec.room.coolingRedundancy;
  const airCapacityKw = effectiveCapacity(
    units.filter((u) => u.kind !== "cdu"),
    red,
  );
  const liquidCapacityKw = effectiveCapacity(
    units.filter((u) => u.kind === "cdu"),
    red,
  );
  const issues: Issue[] = racks.flatMap((r) => r.issues);
  if (airKw > airCapacityKw)
    issues.unshift({
      severity: "critical",
      message: `Heat to air ${airKw.toFixed(0)} kW exceeds room air cooling ${airCapacityKw.toFixed(0)} kW (${red})`,
    });
  else if (airCapacityKw && airKw > 0.85 * airCapacityKw)
    issues.unshift({
      severity: "warning",
      message: `Room air cooling ${Math.round((airKw / airCapacityKw) * 100)}% used (${red})`,
    });
  if (liquidKw > 0 && liquidCapacityKw === 0)
    issues.unshift({
      severity: "critical",
      message: `${liquidKw.toFixed(0)} kW goes to liquid but there is no CDU / facility water capacity`,
    });
  else if (liquidKw > liquidCapacityKw)
    issues.unshift({
      severity: "critical",
      message: `Liquid heat ${liquidKw.toFixed(0)} kW exceeds CDU capacity ${liquidCapacityKw.toFixed(0)} kW (${red})`,
    });
  if (drawKw > spec.room.upsCapacityKw)
    issues.unshift({
      severity: "critical",
      message: `IT load ${drawKw.toFixed(0)} kW exceeds UPS capacity ${spec.room.upsCapacityKw} kW`,
    });
  else if (maxKw > spec.room.upsCapacityKw)
    issues.unshift({
      severity: "warning",
      message: `Nameplate ${maxKw.toFixed(0)} kW exceeds UPS ${spec.room.upsCapacityKw} kW (running load fits)`,
    });
  const coolingPower = airKw / COP_AIR + liquidKw / COP_LIQUID;
  const pue = drawKw ? (drawKw + coolingPower + drawKw * 0.06 + drawKw * 0.02) / drawKw : 0;
  const areaM2 = spec.room.widthTiles * spec.room.depthTiles * TILE_M * TILE_M;
  const totalU = spec.racks.reduce((s, r) => s + r.heightU, 0);
  return {
    racks,
    drawKw,
    maxKw,
    airKw,
    liquidKw,
    airCapacityKw,
    liquidCapacityKw,
    upsCapacityKw: spec.room.upsCapacityKw,
    pue,
    areaM2,
    whitespaceUtilization: areaM2 ? (spec.racks.length * RACK_FOOTPRINT_M2) / areaM2 : 0,
    uUtilization: totalU ? racks.reduce((s, r) => s + r.usedU, 0) / totalU : 0,
    issues,
    formulas: [
      `Device draw = max kW × (${IDLE} + ${1 - IDLE} × utilization); default utilization ${Math.round(spec.assumptions.utilization * 100)}%`,
      `Heat (BTU/hr) = kW × ${BTU_PER_KW}`,
      `Direct-liquid devices send ${DLC_LIQUID_FRACTION * 100}% of heat to liquid; immersion 100%; rear-door HX removes up to ${RACK_COOLING_LIMIT_KW["rear-door-hx"]} kW per rack`,
      `Cooling capacity after ${red}: N = all units, N+1 = minus the largest unit, 2N = half`,
      `PUE (estimate) = (IT + air heat ÷ COP ${COP_AIR} + liquid heat ÷ COP ${COP_LIQUID} + 6% UPS/distribution loss + 2% other) ÷ IT`,
      `Floor load = (rack ${RACK_EMPTY_KG} kg + devices) ÷ ${RACK_FOOTPRINT_M2} m² footprint`,
    ],
  };
}

/** Load growth vs the binding capacity (UPS, air or liquid cooling): yearly series and years until it runs out. */
export function growth(spec: SandboxSpec, lib: ComponentLibrary) {
  const r = roomCalc(spec, lib);
  const g = spec.assumptions.growthPctPerYear / 100;
  const series = Array.from(
    { length: spec.assumptions.horizonYears + 1 },
    (_, y) => r.drawKw * (1 + g) ** y,
  );
  const share = r.drawKw
    ? { air: r.airKw / r.drawKw, liquid: r.liquidKw / r.drawKw }
    : { air: 1, liquid: 0 };
  const limits = [
    { label: "UPS", kw: r.upsCapacityKw },
    ...(share.air > 0 ? [{ label: "Air cooling", kw: r.airCapacityKw / share.air }] : []),
    ...(share.liquid > 0
      ? [{ label: "Liquid cooling", kw: r.liquidCapacityKw / share.liquid }]
      : []),
  ];
  const binding = limits.reduce((a, b) => (b.kw < a.kw ? b : a));
  const yearsLeft =
    r.drawKw === 0
      ? null
      : r.drawKw >= binding.kw
        ? 0
        : g <= 0
          ? null
          : Math.log(binding.kw / r.drawKw) / Math.log(1 + g);
  return { series, binding, limits, yearsLeft };
}

/** What-ifs: lose one cooling unit, or lose feed A. */
export function failures(spec: SandboxSpec, lib: ComponentLibrary) {
  const base = roomCalc(spec, lib);
  const cooling = spec.coolingUnits.map((u) => {
    const after = roomCalc(
      spec,
      lib,
      spec.coolingUnits.filter((x) => x.id !== u.id),
    );
    // With the unit gone, there's no reserve left: compare the raw remaining capacity.
    const rest = spec.coolingUnits.filter(
      (x) => x.id !== u.id && (u.kind === "cdu" ? x.kind === "cdu" : x.kind !== "cdu"),
    );
    const remaining = rest.reduce((s, x) => s + x.capacityKw, 0);
    const heat = u.kind === "cdu" ? base.liquidKw : base.airKw;
    return { unit: u, remainingKw: remaining, heatKw: heat, ok: heat <= remaining, pue: after.pue };
  });
  const feedA = base.racks.map((r, i) => {
    const rack = spec.racks[i];
    const down = rack.feeds === 1 && r.drawKw > 0;
    const overload = rack.feeds === 2 && r.drawKw > rack.kwPerFeed;
    return {
      rack: r.label,
      status: down ? ("down" as const) : overload ? ("overload" as const) : ("ok" as const),
    };
  });
  return { cooling, feedA };
}

/** Deterministic, clearly simulated telemetry for the ops console (no real systems are read). */
export function telemetry(spec: SandboxSpec, lib: ComponentLibrary, tick: number) {
  const r = roomCalc(spec, lib);
  const airUse = r.airCapacityKw ? r.airKw / r.airCapacityKw : 1;
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const noise = (seed: number) => (((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1) % 1;
  return r.racks.map((rack) => {
    const h = hash(rack.id);
    const wave = 0.08 * Math.sin(tick / 6 + (h % 10)) + 0.03 * (noise(h + tick) - 0.5);
    const kw = Math.max(0, rack.drawKw * (1 + wave));
    const inletC =
      21 +
      7 * Math.max(0, airUse - 0.7) +
      (rack.airKw / Math.max(1, spec.assumptions.airKwPerRack)) * 2 +
      0.6 * (noise(h * 3 + tick) - 0.5);
    return { id: rack.id, label: rack.label, kw, inletC, util: rack.maxKw ? kw / rack.maxKw : 0 };
  });
}
