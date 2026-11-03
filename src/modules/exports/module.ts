import { FileOutput } from "lucide-react";
import type { AccModule } from "../types";

const exportsModule: AccModule = {
  id: "exports",
  title: "Exports",
  description:
    "Executive summary builder with audience modes, redaction, and PDF/Markdown/PPTX output.",
  icon: FileOutput,
  category: "exports",
  order: 50,
  status: "stable",
  routes: [
    { path: "exports", title: "Exports", nav: true, load: () => import("./pages/exports-page") },
  ],
  exportSections: [
    {
      id: "exports.cover",
      title: "Cover & summary",
      description: "Title, scope, audience, date stamp, and version.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [{ id: "cover", label: "Cover page", visibility: "customer-safe" }],
    },
  ],
  commands: [
    {
      id: "nav.exports",
      label: "Open Export Builder",
      group: "Actions",
      href: "/exports",
      keywords: ["pdf", "summary", "qbr"],
    },
  ],
};

export default exportsModule;
