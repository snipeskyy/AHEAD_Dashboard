import { Calculator } from "lucide-react";
import type { AccModule } from "../types";

const businessCases: AccModule = {
  id: "business-cases",
  title: "TCO & business cases",
  description:
    "Multi-year TCO comparisons with NPV, IRR, payback and sensitivity, built only from assumptions you enter.",
  icon: Calculator,
  category: "exports",
  order: 52,
  status: "stable",
  routes: [
    {
      path: "cases",
      title: "TCO & business cases",
      nav: true,
      load: () => import("./pages/cases-page"),
    },
    { path: "cases/[id]", title: "Business case", load: () => import("./pages/case-page") },
  ],
  exportSections: [
    {
      id: "business-cases.tco",
      title: "TCO / business case",
      description:
        "The account's business case (latest final, else latest): headline savings, cumulative cost, annual costs, sensitivity and every assumption.",
      scopes: ["account", "accounts"],
      fields: [
        {
          id: "summary",
          label: "Headline (TCO, savings, NPV, payback, IRR)",
          visibility: "customer-safe",
        },
        {
          id: "charts",
          label: "Cumulative cost & sensitivity charts",
          visibility: "customer-safe",
        },
        { id: "annual", label: "Annual cost table", visibility: "customer-safe" },
        { id: "assumptions", label: "Assumptions", visibility: "customer-safe" },
        { id: "notes", label: "Internal notes", visibility: "internal" },
      ],
    },
  ],
  commands: [
    {
      id: "nav.cases",
      label: "TCO & business cases",
      group: "Navigate",
      href: "/cases",
      keywords: ["tco", "roi", "npv", "business case", "cost"],
    },
    {
      id: "create.case",
      label: "New business case (TCO)",
      group: "Create",
      href: "/cases",
      keywords: ["tco", "roi"],
    },
  ],
};

export default businessCases;
