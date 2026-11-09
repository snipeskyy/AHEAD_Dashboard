/**
 * DC Sandbox data model (add-on, not yet implemented). Persisted as `SandboxScenario.spec` (Json).
 * Units: power in kW, heat in BTU/hr, height in rack units (U), flow in L/min.
 * Everything here is planning-grade and illustrative — not vendor-certified engineering data.
 */
export type CoolingType = "air" | "rear-door-hx" | "direct-liquid" | "immersion";

export interface PowerFeed {
  id: string;
  label: string; // e.g. "Feed A"
  voltage: 208 | 230 | 415 | 480;
  phase: 1 | 3;
  amps: number;
  /** Fraction of breaker rating usable continuously (typically 0.8). */
  derate: number;
}

export interface PlacedDevice {
  id: string;
  profileId: string; // ComponentLibrary profile id
  label?: string;
  /** Lowest occupied U (1 = bottom). */
  position: number;
  /** Utilization 0–1 used to scale typical draw. */
  utilization?: number;
}

export interface Rack {
  id: string;
  label: string;
  heightU: number; // 42 / 45 / 48 / 52
  feeds: PowerFeed[];
  cooling: CoolingType;
  devices: PlacedDevice[];
}

export interface Row {
  id: string;
  label: string;
  /** Hot/cold aisle orientation. */
  aisle: "hot" | "cold";
  racks: Rack[];
}

export interface Room {
  id: string;
  label: string;
  coolingCapacityKw: number;
  rows: Row[];
}

export interface Site {
  id: string;
  label: string;
  rooms: Room[];
}

export interface NetworkLink {
  from: { deviceId: string; port?: string };
  to: { deviceId: string; port?: string };
  speedGbps: number;
}

export interface SandboxScenario {
  id: string;
  name: string;
  /** Optional: the account this scenario was built for. */
  accountId?: string;
  description?: string;
  sites: Site[];
  network: NetworkLink[];
  assumptions: Record<string, number | string>;
  createdAt: string;
  updatedAt: string;
}

export type DeviceCategory =
  "gpu-server" | "cpu-server" | "storage" | "tor-switch" | "spine-switch" | "pdu" | "cdu";

/** A generic device profile. Values are typical planning figures, not vendor specifications. */
export interface DeviceProfile {
  id: string;
  category: DeviceCategory;
  label: string; // generic: "GPU server (8-accelerator, air)"
  heightU: number;
  typicalKw: number;
  maxKw: number;
  cooling: CoolingType;
  /** Typical installed weight (kg), for floor-load checks. */
  weightKg: number;
  ports?: Array<{ speedGbps: number; count: number }>;
  /** Always true for the built-in library. */
  illustrative: true;
  note: string;
}

export interface ComponentLibrary {
  id: string;
  label: string;
  disclaimer: string;
  profiles: DeviceProfile[];
  get(profileId: string): DeviceProfile | undefined;
}

export interface RackResult {
  rackId: string;
  usedU: number;
  freeU: number;
  typicalKw: number;
  maxKw: number;
  heatBtuHr: number;
  feedCapacityKw: number;
  /** maxKw / feedCapacityKw. */
  powerHeadroom: number;
  warnings: string[];
}

export interface SimulationResult {
  scenarioId: string;
  racks: RackResult[];
  totals: { typicalKw: number; maxKw: number; heatBtuHr: number; coolingCapacityKw: number };
  warnings: string[];
  /** Every figure is reproducible: formulas used, in plain language. */
  formulas: string[];
}

/** Pluggable engine: the first implementation will be a pure, explainable capacity calculator. */
export interface SimulationEngine {
  id: string;
  label: string;
  simulate(scenario: SandboxScenario, library: ComponentLibrary): Promise<SimulationResult>;
}
