import { z } from "zod";

/**
 * Sandbox scenario v2 (Phase 12): one room on a 0.6 m tile grid. Racks occupy 1 × 2 tiles (600 × 1200 mm).
 * Planning-grade and illustrative: not vendor-certified engineering. Persisted as `SandboxScenario.spec`.
 */
export const TILE_M = 0.6;
export const RACK_FOOTPRINT_M2 = 0.6 * 1.2;
export const COOLING_TYPES = ["air", "rear-door-hx", "direct-liquid", "immersion"] as const;
export const REDUNDANCY = ["N", "N+1", "2N"] as const;

export const DeviceSchema = z.object({
  id: z.string().min(1).max(40),
  profileId: z.string().min(1).max(60),
  label: z.string().max(60).optional(),
  /** Lowest occupied U (1 = bottom). */
  position: z.number().int().min(1).max(60),
  /** 0–1; scales draw between idle (~30% of max) and max. */
  utilization: z.number().min(0).max(1).optional(),
});

export const RackSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  /** Tile coordinates of the rack's top-left corner. */
  x: z.number().int().min(0).max(200),
  y: z.number().int().min(0).max(200),
  /** 0 = front faces "down" (cold aisle below), 180 = faces up. */
  rotation: z.union([z.literal(0), z.literal(180)]).default(0),
  heightU: z.number().int().min(24).max(58).default(42),
  cooling: z.enum(COOLING_TYPES).default("air"),
  /** Feeds: 1 = single feed; 2 = A+B (each must carry the full load). */
  feeds: z.number().int().min(1).max(2).default(2),
  kwPerFeed: z.number().min(0).max(200).default(17.3),
  devices: z.array(DeviceSchema).max(80).default([]),
});

export const CoolingUnitSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  kind: z.enum(["crah", "in-row", "cdu"]),
  capacityKw: z.number().min(0).max(5000),
  x: z.number().int().min(0).max(200),
  y: z.number().int().min(0).max(200),
});

export const SandboxSpecSchema = z.object({
  version: z.literal(2),
  room: z.object({
    label: z.string().trim().min(1).max(60).default("Data hall"),
    widthTiles: z.number().int().min(4).max(200).default(20),
    depthTiles: z.number().int().min(4).max(200).default(14),
    /** Usable IT power from UPS (kW). */
    upsCapacityKw: z.number().min(0).max(100000).default(300),
    /** Redundancy for cooling units (and the UPS figure is after redundancy). */
    coolingRedundancy: z.enum(REDUNDANCY).default("N+1"),
    maxFloorLoadKgM2: z.number().min(0).max(5000).default(1200),
  }),
  racks: z.array(RackSchema).max(400).default([]),
  coolingUnits: z.array(CoolingUnitSchema).max(100).default([]),
  assumptions: z.object({
    /** Default utilization for devices without their own (0–1). */
    utilization: z.number().min(0).max(1).default(0.7),
    growthPctPerYear: z.number().min(-50).max(200).default(15),
    horizonYears: z.number().int().min(1).max(15).default(5),
    /** Per-rack air-cooling ceiling (kW) before warnings. */
    airKwPerRack: z.number().min(1).max(60).default(15),
  }),
  notes: z.string().max(4000).optional(),
});
export type SandboxSpec = z.infer<typeof SandboxSpecSchema>;
export type SpecRack = z.infer<typeof RackSchema>;
export type SpecDevice = z.infer<typeof DeviceSchema>;
export type CoolingUnit = z.infer<typeof CoolingUnitSchema>;

export const emptySpec = (): SandboxSpec =>
  SandboxSpecSchema.parse({ version: 2, room: {}, assumptions: {} });
