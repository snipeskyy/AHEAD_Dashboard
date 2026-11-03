import { Settings } from "lucide-react";
import type { AccModule } from "../types";

const settings: AccModule = {
  id: "settings",
  title: "Settings",
  description:
    "Appearance, taxonomy, tagging rules, scoring weights, data sources, feature flags, backup.",
  icon: Settings,
  category: "system",
  order: 100,
  status: "stable",
  routes: [
    { path: "settings", title: "Settings", nav: true, load: () => import("./pages/settings-page") },
  ],
  exportSections: [],
  commands: [
    {
      id: "nav.settings",
      label: "Open Settings",
      group: "Navigate",
      href: "/settings",
      shortcut: "G ,",
    },
    {
      id: "action.theme",
      label: "Toggle light / dark theme",
      group: "Actions",
      action: "theme.toggle",
    },
    {
      id: "action.presentation",
      label: "Toggle Presentation Mode",
      group: "Actions",
      action: "presentation.toggle",
    },
  ],
};

export default settings;
