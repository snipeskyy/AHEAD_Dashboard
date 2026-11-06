import { Share2 } from "lucide-react";
import type { AccModule } from "../types";

const sharing: AccModule = {
  id: "sharing",
  title: "Team & sharing",
  description: "Shareable account packs, the shared Play Library, and the audit log. Everything stays local until you hand a file to a teammate.",
  icon: Share2,
  category: "exports",
  order: 55,
  status: "stable",
  routes: [{ path: "share", title: "Team & sharing", nav: true, load: () => import("./pages/share-page") }],
  exportSections: [],
  commands: [
    { id: "nav.share", label: "Share accounts as a pack", group: "Navigate", href: "/share", keywords: ["pack", "team", "teammate", "export json"] },
    { id: "nav.share-import", label: "Import a teammate's pack", group: "Create", href: "/share?tab=import", keywords: ["pack", "import json"] },
    { id: "nav.audit", label: "Audit log", group: "Navigate", href: "/share?tab=audit", keywords: ["history", "who", "deleted"] },
  ],
};

export default sharing;
