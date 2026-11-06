import { Handshake } from "lucide-react";
import type { AccModule } from "../types";

const partners: AccModule = {
  id: "partners",
  title: "Partners",
  description: "Partner and OEM co-sell: reps, accounts they cover, shared pipeline, deal registrations and joint touches (all user-entered).",
  icon: Handshake,
  category: "pipeline",
  order: 26,
  status: "stable",
  routes: [{ path: "partners", title: "Partners", nav: true, load: () => import("./pages/partners-page") }],
  exportSections: [],
  commands: [{ id: "nav.partners", label: "Go to Partners (co-sell)", group: "Navigate", href: "/partners", shortcut: "G P", keywords: ["oem", "co-sell", "registration"] }],
};

export default partners;
