import type { ModuleCategory } from "@/modules/types";

export const NAV_GROUPS: Array<{ label: string; categories: ModuleCategory[] }> = [
  { label: "Intelligence", categories: ["intel"] },
  { label: "Pipeline", categories: ["pipeline"] },
  { label: "Engage", categories: ["demand-gen"] },
  { label: "Deliver", categories: ["exports", "sandbox", "addon"] },
];

export const routeHref = (path: string) => "/" + path;
