import { Building2 } from "lucide-react";
import { z } from "zod";
import type { AccModule } from "../types";

const accountIntel: AccModule = {
  id: "account-intel",
  title: "Accounts",
  description: "Account 360: firmographics, intelligence, buying committee, whitespace, and plans.",
  icon: Building2,
  category: "intel",
  order: 10,
  status: "stable",
  routes: [
    { path: "accounts", title: "Accounts", nav: true, load: () => import("./pages/accounts-page") },
    {
      path: "accounts/import",
      title: "Import accounts",
      load: () => import("./pages/import-redirect"),
    },
    { path: "accounts/[id]", title: "Account 360", load: () => import("./pages/account-360-page") },
    { path: "accounts/[id]/brief", title: "Meeting prep brief", load: () => import("./pages/brief-page") },
  ],
  widgets: [
    {
      id: "account-intel.health-heatmap",
      title: "Account health heatmap",
      description: "Accounts × health dimensions",
      defaultSize: "lg",
      sizes: ["md", "lg", "xl"],
      load: () => import("./widgets/health-heatmap"),
    },
    {
      id: "account-intel.top-movers",
      title: "Top movers this week",
      description: "Biggest changes in pipeline and signals",
      defaultSize: "md",
      sizes: ["sm", "md", "lg"],
      load: () => import("./widgets/top-movers"),
    },
  ],
  settingsSchema: z.object({
    staleTouchDays: z
      .number()
      .int()
      .min(7)
      .max(180)
      .default(30)
      .describe("Days without a touch before an account is flagged"),
  }),
  exportSections: [
    {
      id: "account-intel.brief",
      title: "Meeting prep brief",
      description: "One page: snapshot, latest signals, open deals, buying committee, recent touches, evidence, plays and questions.",
      scopes: ["account"],
      internalOnly: true,
      fields: [
        { id: "snapshot", label: "Snapshot", visibility: "customer-safe" },
        { id: "signals", label: "Latest signals", visibility: "internal" },
        { id: "opps", label: "Open opportunities", visibility: "internal" },
        { id: "committee", label: "Buying committee", visibility: "internal" },
        { id: "touches", label: "Recent touches", visibility: "internal" },
        { id: "evidence", label: "Initiative evidence", visibility: "customer-safe" },
        { id: "plays", label: "Recommended plays", visibility: "internal" },
        { id: "questions", label: "Suggested questions", visibility: "internal" },
      ],
    },
    {
      id: "account-intel.overview",
      title: "Account overview",
      description: "Firmographics, tier, health and whitespace scores.",
      scopes: ["account", "accounts"],
      fields: [
        { id: "firmographics", label: "Firmographics", visibility: "customer-safe" },
        { id: "tier", label: "Tier", visibility: "internal" },
        { id: "healthScore", label: "Health score", visibility: "internal" },
        { id: "whitespaceScore", label: "Whitespace score", visibility: "internal" },
      ],
    },
    {
      id: "account-intel.initiatives",
      title: "Strategic initiatives",
      description: "Initiatives with evidence and confidence.",
      scopes: ["account", "accounts"],
      fields: [
        { id: "initiatives", label: "Initiatives", visibility: "customer-safe" },
        { id: "confidence", label: "Confidence", visibility: "internal" },
        { id: "evidence", label: "Evidence links", visibility: "customer-safe" },
      ],
    },
    {
      id: "account-intel.buying-committee",
      title: "Buying committee",
      description: "Persona map, buying roles, and coverage gaps.",
      scopes: ["account"],
      internalOnly: true,
      fields: [
        { id: "personas", label: "Personas", visibility: "internal" },
        { id: "gaps", label: "Coverage gaps", visibility: "internal" },
      ],
    },
    {
      id: "account-intel.whitespace",
      title: "Whitespace map",
      description: "Practice areas by engagement status.",
      scopes: ["account", "accounts", "portfolio"],
      fields: [{ id: "matrix", label: "Practice × status matrix", visibility: "customer-safe" }],
    },
    {
      id: "account-intel.plan",
      title: "Account plan",
      description: "Objectives, strategies, actions, owners, dates.",
      scopes: ["account"],
      fields: [
        { id: "objectives", label: "Objectives", visibility: "customer-safe" },
        { id: "actions", label: "Actions & owners", visibility: "customer-safe" },
        { id: "internalNotes", label: "Internal notes", visibility: "internal" },
      ],
    },
  ],
  commands: [
    {
      id: "nav.accounts",
      label: "Go to Accounts",
      group: "Navigate",
      href: "/accounts",
      shortcut: "G A",
    },
    {
      id: "create.import",
      label: "Import accounts (CSV, Excel or paste)",
      group: "Create",
      href: "/import?kind=accounts",
      keywords: ["csv", "upload", "xlsx", "excel", "paste"],
    },
    {
      id: "create.note",
      label: "Add note…",
      group: "Create",
      action: "note.create",
      keywords: ["memo"],
    },
  ],
};

export default accountIntel;
