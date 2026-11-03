import { Megaphone } from "lucide-react";
import type { AccModule } from "../types";

const demandGen: AccModule = {
  id: "demand-gen",
  title: "Demand Gen",
  description: "Play library, recommender, campaign planner, message builder, and events.",
  icon: Megaphone,
  category: "demand-gen",
  order: 40,
  status: "stable",
  featureFlag: "module.demand-gen",
  routes: [
    {
      path: "demand-gen",
      title: "Demand Gen",
      nav: true,
      load: () => import("./pages/demand-gen-page"),
    },
  ],
  widgets: [],
  exportSections: [
    {
      id: "demand-gen.recommended-plays",
      title: "Recommended plays",
      description: "Top plays per account with the reasoning behind each.",
      scopes: ["account", "accounts"],
      internalOnly: true,
      fields: [
        { id: "plays", label: "Plays", visibility: "internal" },
        { id: "why", label: "Rationale", visibility: "internal" },
      ],
    },
    {
      id: "demand-gen.engagement",
      title: "Engagement summary",
      description: "Touches, meetings, and upcoming events.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [
        { id: "touches", label: "Touch counts", visibility: "internal" },
        { id: "events", label: "Upcoming events & briefings", visibility: "customer-safe" },
      ],
    },
  ],
  commands: [
    {
      id: "nav.demand-gen",
      label: "Go to Demand Gen",
      group: "Navigate",
      href: "/demand-gen",
      shortcut: "G D",
    },
  ],
};

export default demandGen;
