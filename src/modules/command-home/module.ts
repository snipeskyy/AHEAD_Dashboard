import { LayoutDashboard } from "lucide-react";
import type { AccModule } from "../types";

const commandHome: AccModule = {
  id: "command-home",
  title: "Command Home",
  description: "Portfolio dashboard with a customizable widget grid.",
  icon: LayoutDashboard,
  category: "intel",
  order: 1,
  status: "stable",
  routes: [
    { path: "dashboard", title: "Command Home", nav: true, load: () => import("./pages/home-page") },
  ],
  widgets: [
    {
      id: "command-home.next-best-actions",
      title: "Next best actions",
      description: "Prioritized actions with reasons",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/next-best-actions"),
    },
    {
      id: "command-home.whats-changed",
      title: "What changed since you last looked",
      description: "Activity and new high-relevance signals",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/whats-changed"),
    },
  ],
  exportSections: [
    {
      id: "command-home.kpis",
      title: "Portfolio KPIs",
      description: "Pipeline, weighted pipeline, win rate, coverage, and cycle time.",
      scopes: ["portfolio", "accounts"],
      fields: [
        { id: "pipelineTotal", label: "Pipeline total", visibility: "internal" },
        { id: "weightedPipeline", label: "Weighted pipeline", visibility: "internal" },
        { id: "winRate", label: "Win rate", visibility: "internal" },
        { id: "activeOpps", label: "Active opportunities", visibility: "customer-safe" },
        { id: "avgCycle", label: "Average deal cycle", visibility: "internal" },
      ],
    },
    {
      id: "command-home.whats-changed",
      title: "What changed",
      description: "Activity and new high-relevance signals since the last review.",
      scopes: ["portfolio", "accounts", "account"],
      internalOnly: true,
      fields: [{ id: "changes", label: "Change log", visibility: "internal" }],
    },
  ],
  commands: [
    { id: "nav.home", label: "Go to Command Home (dashboard)", group: "Navigate", href: "/dashboard", shortcut: "G B" },
  ],
};

export default commandHome;
