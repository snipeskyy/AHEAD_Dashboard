import { Radio } from "lucide-react";
import { z } from "zod";
import type { AccModule } from "../types";

const signals: AccModule = {
  id: "signals",
  title: "Live Signals",
  description: "Real-time public signals across all accounts, auto-tagged and scored.",
  icon: Radio,
  category: "intel",
  order: 20,
  status: "stable",
  featureFlag: "module.signals",
  routes: [
    {
      path: "signals",
      title: "Live Signals",
      nav: true,
      load: () => import("./pages/signals-page"),
    },
  ],
  widgets: [],
  settingsSchema: z.object({
    alertThreshold: z
      .number()
      .min(0)
      .max(100)
      .default(75)
      .describe("Relevance score that triggers a notification"),
    desktopNotifications: z.boolean().default(false).describe("Also show desktop notifications"),
  }),
  exportSections: [
    {
      id: "signals.key-signals",
      title: "Key signals",
      description: "Signals flagged for the next executive summary, plus top-relevance signals.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [
        { id: "title", label: "Headline & link", visibility: "customer-safe" },
        { id: "relevance", label: "Relevance score", visibility: "internal" },
        { id: "practiceTags", label: "Practice tags", visibility: "customer-safe" },
      ],
    },
  ],
  commands: [
    {
      id: "nav.signals",
      label: "Go to Live Signals",
      group: "Navigate",
      href: "/signals",
      shortcut: "G S",
    },
  ],
};

export default signals;
