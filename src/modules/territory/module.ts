import { Map as MapIcon } from "lucide-react";
import { z } from "zod";
import type { AccModule } from "../types";

const territory: AccModule = {
  id: "territory",
  title: "Territory",
  description: "Coverage cadence by tier, neglected accounts, momentum, budget timing and the data Fix-it queue.",
  icon: MapIcon,
  category: "intel",
  order: 12,
  status: "stable",
  routes: [
    { path: "territory", title: "Territory", nav: true, load: () => import("./pages/territory-page") },
    { path: "fix-it", title: "Fix-it queue", load: () => import("./pages/fix-it-page") },
  ],
  widgets: [
    {
      id: "territory.fiscal-timeline",
      title: "Budget timing",
      description: "Fiscal-year ends and likely planning windows across the portfolio",
      defaultSize: "lg",
      sizes: ["md", "lg", "xl"],
      load: () => import("./widgets/fiscal-timeline-widget"),
    },
    {
      id: "territory.neglected",
      title: "Neglected accounts",
      description: "Past their touch cadence",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/neglected-widget"),
    },
  ],
  settingsSchema: z.object({
    strategicDays: z.number().int().min(1).max(365).default(14).describe("Touch cadence: Strategic accounts (days)"),
    growthDays: z.number().int().min(1).max(365).default(30).describe("Touch cadence: Growth accounts (days)"),
    maintainDays: z.number().int().min(1).max(365).default(60).describe("Touch cadence: Maintain accounts (days)"),
    planningStartMonths: z.number().int().min(1).max(12).default(5).describe("Budget planning starts this many months before the fiscal year"),
    planningEndMonths: z.number().int().min(0).max(11).default(2).describe("…and ends this many months before it"),
  }),
  exportSections: [],
  commands: [
    { id: "nav.territory", label: "Go to Territory", group: "Navigate", href: "/territory", shortcut: "G R" },
    { id: "nav.fixit", label: "Fix-it queue (missing account data)", group: "Navigate", href: "/fix-it", keywords: ["data quality", "completeness", "gaps"] },
  ],
};

export default territory;
