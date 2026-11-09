import { SandboxSpecSchema, type SandboxSpec, type SpecRack } from "./spec";

/** Starter rooms built from the generic, illustrative library (no vendors, no prices). */
const rack = (
  id: string,
  label: string,
  x: number,
  y: number,
  devices: SpecRack["devices"],
  o: Partial<SpecRack> = {},
): SpecRack =>
  ({
    id,
    label,
    x,
    y,
    rotation: 0,
    heightU: 42,
    cooling: "air",
    feeds: 2,
    kwPerFeed: 17.3,
    devices,
    ...o,
  }) as SpecRack;

const computeRack = (n: number) => [
  { id: `t${n}`, profileId: "tor-1u", position: 42 },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `c${n}-${i}`,
    profileId: "cpu-2u",
    position: 38 - i * 2,
  })),
  { id: `s${n}`, profileId: "storage-2u", position: 12 },
];

const gpuRack = (n: number) => [
  { id: `t${n}`, profileId: "tor-1u", position: 42 },
  { id: `t${n}b`, profileId: "tor-1u", position: 41 },
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `g${n}-${i}`,
    profileId: "gpu-8x-liquid",
    position: 34 - i * 5,
  })),
  { id: `cdu${n}`, profileId: "cdu-4u", position: 1 },
];

export const SANDBOX_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  spec: SandboxSpec;
}> = [
  {
    id: "empty",
    name: "Empty room",
    description: "A 12 × 8.4 m hall with two air handlers. Add racks from the floor plan.",
    spec: SandboxSpecSchema.parse({
      version: 2,
      room: { widthTiles: 20, depthTiles: 14, upsCapacityKw: 300 },
      coolingUnits: [
        { id: "crah1", label: "CRAH-1", kind: "crah", capacityKw: 150, x: 0, y: 0 },
        { id: "crah2", label: "CRAH-2", kind: "crah", capacityKw: 150, x: 0, y: 12 },
      ],
      assumptions: {},
    }),
  },
  {
    id: "enterprise-row",
    name: "Enterprise row (10 air-cooled racks)",
    description: "General compute and storage in a hot/cold-aisle row, N+1 air cooling.",
    spec: SandboxSpecSchema.parse({
      version: 2,
      room: { widthTiles: 20, depthTiles: 14, upsCapacityKw: 200 },
      racks: Array.from({ length: 10 }, (_, i) =>
        rack(`r${i + 1}`, `R${String(i + 1).padStart(2, "0")}`, 3 + i, 4, computeRack(i)),
      ),
      coolingUnits: [
        { id: "crah1", label: "CRAH-1", kind: "crah", capacityKw: 90, x: 0, y: 2 },
        { id: "crah2", label: "CRAH-2", kind: "crah", capacityKw: 90, x: 0, y: 8 },
        { id: "crah3", label: "CRAH-3", kind: "crah", capacityKw: 90, x: 18, y: 5 },
      ],
      assumptions: {},
    }),
  },
  {
    id: "ai-pod",
    name: "AI pod (4 liquid-cooled GPU racks)",
    description:
      "Direct-liquid GPU racks with in-rack CDUs, a facility CDU, and air for residual heat.",
    spec: SandboxSpecSchema.parse({
      version: 2,
      room: { widthTiles: 16, depthTiles: 12, upsCapacityKw: 400 },
      racks: Array.from({ length: 4 }, (_, i) =>
        rack(`g${i + 1}`, `AI-${i + 1}`, 4 + i, 4, gpuRack(i), {
          cooling: "direct-liquid",
          kwPerFeed: 57.5,
        }),
      ),
      coolingUnits: [
        { id: "cdu1", label: "CDU-1", kind: "cdu", capacityKw: 200, x: 12, y: 3 },
        { id: "cdu2", label: "CDU-2", kind: "cdu", capacityKw: 200, x: 12, y: 6 },
        { id: "irc1", label: "In-row 1", kind: "in-row", capacityKw: 40, x: 2, y: 4 },
        { id: "irc2", label: "In-row 2", kind: "in-row", capacityKw: 40, x: 8, y: 4 },
      ],
      assumptions: { growthPctPerYear: 30 },
    }),
  },
];
