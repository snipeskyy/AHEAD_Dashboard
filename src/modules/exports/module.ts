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
    {
      id: "exports.exec-summary",
      title: "Executive summary",
      description: "Where the account is today, its public priorities and where we can help, written from recorded data.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [
        { id: "situation", label: "Situation", visibility: "customer-safe" },
        { id: "pipeline", label: "Pipeline & health", visibility: "internal" },
        { id: "priorities", label: "Their priorities (with sources)", visibility: "customer-safe" },
        { id: "pov", label: "Where we can help", visibility: "customer-safe" },
      ],
    },
    {
      id: "exports.next-steps",
      title: "Next steps",
      description: "Agreed plan actions, then deal next steps and open tasks. Closes a deck.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [
        { id: "actions", label: "Agreed actions (account plan)", visibility: "customer-safe" },
        { id: "followups", label: "Deal next steps & tasks", visibility: "internal" },
      ],
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
