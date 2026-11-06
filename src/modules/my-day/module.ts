import { Sun } from "lucide-react";
import type { AccModule } from "../types";

const myDay: AccModule = {
  id: "my-day",
  title: "My Day",
  description: "Today's meetings, the signals that matter since your last visit, tasks due, accounts past cadence and deals needing attention.",
  icon: Sun,
  category: "intel",
  order: 0,
  status: "stable",
  routes: [{ path: "", title: "My Day", nav: true, load: () => import("./pages/my-day-page") }],
  exportSections: [],
  commands: [
    { id: "nav.myday", label: "Go to My Day", group: "Navigate", href: "/", shortcut: "G H" },
    { id: "calendar.import", label: "Import calendar (.ics) on My Day", group: "Create", href: "/", keywords: ["meetings", "calendar", "ics", "outlook", "google"] },
  ],
};

export default myDay;
