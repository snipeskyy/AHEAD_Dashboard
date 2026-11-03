import { KanbanSquare } from "lucide-react";
import { z } from "zod";
import type { AccModule } from "../types";

const opportunities: AccModule = {
  id: "opportunities",
  title: "Opportunities",
  description: "Kanban, table, and forecast views with MEDDPICC and deal-risk heuristics.",
  icon: KanbanSquare,
  category: "pipeline",
  order: 30,
  status: "stable",
  routes: [
    {
      path: "opportunities",
      title: "Opportunities",
      nav: true,
      load: () => import("./pages/opportunities-page"),
    },
  ],
  widgets: [
    {
      id: "opportunities.pipeline-by-stage",
      title: "Pipeline by stage",
      description: "Open amount per stage (funnel)",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/pipeline-by-stage"),
    },
    {
      id: "opportunities.pipeline-by-practice",
      title: "Pipeline by practice area",
      description: "Open amount per practice area",
      defaultSize: "md",
      sizes: ["md", "lg"],
      load: () => import("./widgets/pipeline-by-practice"),
    },
    {
      id: "opportunities.forecast-vs-target",
      title: "Forecast vs target",
      description: "Closed won, commit, best case and pipeline by quarter",
      defaultSize: "lg",
      sizes: ["md", "lg", "xl"],
      internalOnly: true,
      load: () => import("./widgets/forecast"),
    },
    {
      id: "opportunities.upcoming-closes",
      title: "Upcoming close dates",
      description: "Open deals closing in the next 45 days",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/upcoming-closes"),
    },
    {
      id: "opportunities.stalled-deals",
      title: "Stalled deals",
      description: "No stage change beyond the stalled threshold",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/stalled-deals"),
    },
  ],
  settingsSchema: z.object({
    stalledDays: z
      .number()
      .int()
      .min(7)
      .max(120)
      .default(30)
      .describe("Days without a stage change before a deal is 'stalled'"),
    quarterlyTarget: z
      .number()
      .min(0)
      .default(30_000_000)
      .describe("Quarterly bookings target (USD)"),
    coverageTarget: z.number().min(1).max(6).default(3).describe("Pipeline coverage ratio target"),
  }),
  exportSections: [
    {
      id: "opportunities.pipeline",
      title: "Pipeline summary",
      description: "Open opportunities by stage and practice area.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [
        { id: "name", label: "Opportunity name", visibility: "customer-safe" },
        { id: "practiceArea", label: "Practice area", visibility: "customer-safe" },
        { id: "stage", label: "Stage", visibility: "internal" },
        { id: "amount", label: "Amount", visibility: "internal" },
        { id: "probability", label: "Probability", visibility: "internal" },
        { id: "closeDate", label: "Target date", visibility: "customer-safe" },
        { id: "competitors", label: "Competitors", visibility: "internal" },
        { id: "riskFlags", label: "Risk flags", visibility: "internal" },
      ],
    },
    {
      id: "opportunities.forecast",
      title: "Forecast",
      description: "Commit / best case / pipeline by month and quarter.",
      scopes: ["accounts", "portfolio"],
      internalOnly: true,
      fields: [{ id: "forecast", label: "Forecast table", visibility: "internal" }],
    },
  ],
  commands: [
    {
      id: "nav.opps",
      label: "Go to Opportunities",
      group: "Navigate",
      href: "/opportunities",
      shortcut: "G O",
    },
    {
      id: "create.opp",
      label: "Create opportunity…",
      group: "Create",
      action: "opportunity.create",
      keywords: ["deal", "new"],
    },
  ],
};

export default opportunities;
