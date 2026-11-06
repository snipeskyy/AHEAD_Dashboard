import { ListFilter } from "lucide-react";
import type { AccModule } from "../types";

const smartLists: AccModule = {
  id: "smart-lists",
  title: "Smart lists",
  description: "Saved filters across accounts, opportunities and signals, built with a query builder and pinned to the sidebar.",
  icon: ListFilter,
  category: "intel",
  order: 14,
  status: "stable",
  routes: [
    { path: "lists", title: "Smart lists", nav: true, load: () => import("./pages/lists-page") },
    { path: "lists/[id]", title: "Smart list", load: () => import("./pages/list-page") },
  ],
  exportSections: [],
  commands: [{ id: "nav.lists", label: "Smart lists (saved filters)", group: "Navigate", href: "/lists", shortcut: "G L", keywords: ["filter", "segment", "query"] }],
};

export default smartLists;
