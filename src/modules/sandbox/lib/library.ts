import type { ComponentLibrary, DeviceProfile } from "./types";

export const LIBRARY_DISCLAIMER =
  "Illustrative, not vendor-certified. Generic planning figures for early sizing conversations only.";

const p = (x: Omit<DeviceProfile, "illustrative">): DeviceProfile => ({ ...x, illustrative: true });

/** Built-in generic device profiles. No vendor names or model numbers, by design. */
export const ILLUSTRATIVE_PROFILES: DeviceProfile[] = [
  p({
    id: "gpu-8x-air",
    category: "gpu-server",
    label: "GPU server (8-accelerator, air-cooled)",
    heightU: 8,
    typicalKw: 8.5,
    maxKw: 10.2,
    cooling: "air",
    ports: [{ speedGbps: 400, count: 8 }],
    note: "Dense training node; often limits racks to 2–4 per air-cooled rack.",
  }),
  p({
    id: "gpu-8x-liquid",
    category: "gpu-server",
    label: "GPU server (8-accelerator, direct liquid)",
    heightU: 4,
    typicalKw: 9.0,
    maxKw: 11.0,
    cooling: "direct-liquid",
    ports: [{ speedGbps: 400, count: 8 }],
    note: "Most heat removed to liquid loop; residual heat to air.",
  }),
  p({
    id: "cpu-1u",
    category: "cpu-server",
    label: "CPU server (1U, dual-socket)",
    heightU: 1,
    typicalKw: 0.45,
    maxKw: 0.8,
    cooling: "air",
    ports: [{ speedGbps: 25, count: 2 }],
    note: "General-purpose compute.",
  }),
  p({
    id: "cpu-2u",
    category: "cpu-server",
    label: "CPU server (2U, dual-socket)",
    heightU: 2,
    typicalKw: 0.6,
    maxKw: 1.1,
    cooling: "air",
    ports: [{ speedGbps: 25, count: 4 }],
    note: "Virtualization / database host.",
  }),
  p({
    id: "storage-2u",
    category: "storage",
    label: "Storage array (2U, all-flash)",
    heightU: 2,
    typicalKw: 0.9,
    maxKw: 1.4,
    cooling: "air",
    ports: [{ speedGbps: 100, count: 4 }],
    note: "Controller shelf; expansion shelves add ~0.5 kW each.",
  }),
  p({
    id: "tor-1u",
    category: "tor-switch",
    label: "Top-of-rack switch (1U)",
    heightU: 1,
    typicalKw: 0.35,
    maxKw: 0.6,
    cooling: "air",
    ports: [{ speedGbps: 100, count: 32 }],
    note: "Leaf switch.",
  }),
  p({
    id: "spine-2u",
    category: "spine-switch",
    label: "Spine switch (2U)",
    heightU: 2,
    typicalKw: 1.2,
    maxKw: 1.8,
    cooling: "air",
    ports: [{ speedGbps: 400, count: 64 }],
    note: "Fabric spine.",
  }),
  p({
    id: "pdu-0u",
    category: "pdu",
    label: "Rack PDU (0U, 3-phase)",
    heightU: 0,
    typicalKw: 0,
    maxKw: 0,
    cooling: "air",
    note: "Vertical; does not consume rack units.",
  }),
  p({
    id: "cdu-4u",
    category: "cdu",
    label: "Coolant distribution unit (in-rack, 4U)",
    heightU: 4,
    typicalKw: 0.5,
    maxKw: 0.8,
    cooling: "direct-liquid",
    note: "In-rack CDU for direct-liquid nodes.",
  }),
];

export function createLibrary(profiles: DeviceProfile[] = ILLUSTRATIVE_PROFILES): ComponentLibrary {
  const byId = new Map(profiles.map((x) => [x.id, x]));
  return {
    id: "illustrative",
    label: "Illustrative library",
    disclaimer: LIBRARY_DISCLAIMER,
    profiles,
    get: (id) => byId.get(id),
  };
}

/** Static preview rack used by the landing page (no persistence). */
export const PREVIEW_RACKS: Array<{
  label: string;
  heightU: number;
  feedKw: number;
  devices: Array<{ profileId: string; position: number }>;
}> = [
  {
    label: "R01 · AI training",
    heightU: 42,
    feedKw: 34.6,
    devices: [
      { profileId: "tor-1u", position: 42 },
      { profileId: "tor-1u", position: 41 },
      { profileId: "gpu-8x-liquid", position: 35 },
      { profileId: "gpu-8x-liquid", position: 30 },
      { profileId: "gpu-8x-liquid", position: 25 },
      { profileId: "cdu-4u", position: 1 },
    ],
  },
  {
    label: "R02 · General compute",
    heightU: 42,
    feedKw: 17.3,
    devices: [
      { profileId: "tor-1u", position: 42 },
      { profileId: "spine-2u", position: 39 },
      ...Array.from({ length: 8 }, (_, i) => ({ profileId: "cpu-2u", position: 36 - i * 2 })),
      { profileId: "storage-2u", position: 12 },
      { profileId: "storage-2u", position: 10 },
      { profileId: "cpu-1u", position: 8 },
      { profileId: "cpu-1u", position: 7 },
    ],
  },
];
