import { UsersRound } from "lucide-react";
import type { AccModule } from "../types";

const team: AccModule = {
  id: "team",
  title: "Team workspace",
  description:
    "Workload by teammate, the shared territory plan, mutual action plan health and the weekly team digest.",
  icon: UsersRound,
  category: "pipeline",
  order: 27,
  status: "stable",
  routes: [
    { path: "team", title: "Team workspace", nav: true, load: () => import("./pages/team-page") },
  ],
  exportSections: [],
  commands: [
    {
      id: "nav.team",
      label: "Go to Team workspace",
      group: "Navigate",
      href: "/team",
      shortcut: "G W",
      keywords: ["workload", "assignee", "territory plan"],
    },
    {
      id: "team.digest",
      label: "Weekly team digest",
      group: "Actions",
      href: "/team?tab=digest",
      keywords: ["digest", "weekly", "summary", "report"],
    },
  ],
};

export default team;
