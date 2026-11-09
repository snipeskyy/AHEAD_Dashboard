import { Server } from "lucide-react";
import type { AccModule } from "../types";

const sandbox: AccModule = {
  id: "sandbox",
  title: "DC Sandbox",
  description:
    "Data center scenario sandbox: floor plan and rack editor, power/cooling/PUE, growth and failure what-ifs, 3D walkthrough, simulated ops and a customer tour.",
  icon: Server,
  category: "sandbox",
  order: 60,
  status: "stable",
  featureFlag: "module.sandbox",
  routes: [
    { path: "sandbox", title: "DC Sandbox", nav: true, load: () => import("./pages/sandbox-page") },
    {
      path: "sandbox/[id]",
      title: "Sandbox scenario",
      load: () => import("./pages/scenario-page"),
    },
  ],
  exportSections: [
    {
      id: "sandbox.views",
      title: "Sandbox views",
      description: "Floor plan and rack elevations from the account's latest sandbox scenario.",
      scopes: ["account"],
      fields: [
        { id: "floor", label: "Floor plan", visibility: "customer-safe" },
        { id: "racks", label: "Rack elevations", visibility: "customer-safe" },
      ],
    },
    {
      id: "sandbox.capacity",
      title: "Capacity tables",
      description: "Power, heat, cooling, PUE, growth runway and resilience (illustrative).",
      scopes: ["account"],
      fields: [
        { id: "capacity", label: "Capacity summary & per-rack table", visibility: "customer-safe" },
        { id: "growth", label: "Growth runway", visibility: "customer-safe" },
        { id: "issues", label: "Issues & resilience", visibility: "customer-safe" },
      ],
    },
  ],
  commands: [{ id: "nav.sandbox", label: "Go to DC Sandbox", group: "Navigate", href: "/sandbox", shortcut: "G X", keywords: ["data center", "rack", "3d"] }],
};

export default sandbox;
