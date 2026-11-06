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
  exportSections: [
    {
      id: "partners.co-sell",
      title: "Partner co-sell",
      description: "Partner reps on the account, shared deals and pipeline, registrations and recent joint touches (user-entered).",
      scopes: ["account", "accounts"],
      internalOnly: true,
      fields: [
        { id: "reps", label: "Partner reps", visibility: "internal" },
        { id: "deals", label: "Shared deals & pipeline", visibility: "internal" },
        { id: "registrations", label: "Registrations", visibility: "internal" },
        { id: "touches", label: "Joint touches", visibility: "internal" },
      ],
    },
  ],
  commands: [{ id: "nav.partners", label: "Go to Partners (co-sell)", group: "Navigate", href: "/partners", shortcut: "G P", keywords: ["oem", "co-sell", "registration"] }],
};

export default partners;
