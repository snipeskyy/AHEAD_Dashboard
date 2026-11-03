import { Server } from "lucide-react";
import type { AccModule } from "../types";

const sandbox: AccModule = {
  id: "sandbox",
  title: "DC Sandbox",
  description:
    "Data center scenario sandbox — rack elevations, power, cooling, and simulations. (Add-on)",
  icon: Server,
  category: "sandbox",
  order: 60,
  status: "stub",
  featureFlag: "module.sandbox",
  routes: [
    { path: "sandbox", title: "DC Sandbox", nav: true, load: () => import("./pages/sandbox-page") },
  ],
  exportSections: [
    {
      id: "sandbox.views",
      title: "Sandbox views",
      description: "Rack elevation and floor views from a saved scenario.",
      scopes: ["account"],
      fields: [{ id: "screenshots", label: "Scenario views", visibility: "customer-safe" }],
    },
    {
      id: "sandbox.capacity",
      title: "Capacity tables",
      description: "Power, heat, and cooling capacity (illustrative).",
      scopes: ["account"],
      fields: [{ id: "capacity", label: "Capacity table", visibility: "customer-safe" }],
    },
  ],
  commands: [{ id: "nav.sandbox", label: "Go to DC Sandbox", group: "Navigate", href: "/sandbox" }],
};

export default sandbox;
