import { FileUp } from "lucide-react";
import type { AccModule } from "../types";

const imports: AccModule = {
  id: "imports",
  title: "Import",
  description:
    "Import accounts, contacts, opportunities, notes and partner reps from CSV, Excel or a pasted list. Every import can be undone.",
  icon: FileUp,
  category: "system",
  order: 95,
  status: "stable",
  routes: [
    { path: "import", title: "Import data", nav: true, load: () => import("./pages/import-page") },
  ],
  exportSections: [],
  commands: [
    {
      id: "nav.import",
      label: "Import data (CSV, Excel, paste)",
      group: "Create",
      href: "/import",
      keywords: ["csv", "xlsx", "excel", "upload", "paste", "contacts", "opportunities"],
    },
    {
      id: "nav.import-history",
      label: "Import history / undo an import",
      group: "Navigate",
      href: "/import?tab=history",
      keywords: ["undo", "rollback"],
    },
  ],
};

export default imports;
