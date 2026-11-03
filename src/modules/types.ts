import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { ZodObject, ZodRawShape } from "zod";
import type { DataAdapter } from "@/lib/adapters/types";

export type ModuleCategory =
  "intel" | "pipeline" | "demand-gen" | "exports" | "sandbox" | "addon" | "system";
export type WidgetSize = "sm" | "md" | "lg" | "xl";

export interface ModuleRoute {
  /** Path segment(s) under the app root, e.g. "accounts" or "accounts/[id]". */
  path: string;
  title: string;
  /** Show in the sidebar. Only static paths should be in nav. */
  nav?: boolean;
  /** Lazy loader so the shell never imports module code eagerly. */
  load: () => Promise<{ default: ComponentType<{ params: Record<string, string> }> }>;
}

export interface WidgetDefinition {
  id: string; // globally unique: "<module-id>.<widget>"
  title: string;
  description: string;
  defaultSize: WidgetSize;
  sizes: WidgetSize[];
  load: () => Promise<{ default: ComponentType<{ size: WidgetSize }> }>;
}

/** Visibility drives redaction: customer-facing exports strip "internal" fields. */
export type FieldVisibility = "internal" | "customer-safe";

export interface ExportFieldDefinition {
  id: string;
  label: string;
  visibility: FieldVisibility;
}

export type ExportScope = "account" | "accounts" | "portfolio";

export interface ExportSectionDefinition {
  id: string; // "<module-id>.<section>"
  title: string;
  description: string;
  scopes: ExportScope[];
  fields: ExportFieldDefinition[];
  /** Whole section is internal-only (hidden entirely in customer-facing mode). */
  internalOnly?: boolean;
}

export interface CommandDefinition {
  id: string;
  label: string;
  group: "Navigate" | "Create" | "Actions";
  keywords?: string[];
  /** Either navigate to href or dispatch a named UI action (handled by the shell). */
  href?: string;
  action?: string;
  shortcut?: string;
}

export interface AccModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: ModuleCategory;
  /** Sidebar order (lower first). */
  order: number;
  routes?: ModuleRoute[];
  widgets?: WidgetDefinition[];
  exportSections: ExportSectionDefinition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous adapter list; each adapter is typed at its definition
  dataAdapters?: DataAdapter<any, any>[];
  settingsSchema?: ZodObject<ZodRawShape>;
  commands?: CommandDefinition[];
  /** Feature flag key; module is hidden when the flag is off. Defaults to on. */
  featureFlag?: string;
  /** Stub modules show a "Coming next" badge in nav. */
  status?: "stable" | "preview" | "stub";
}
