import { discoveredModules } from "./_generated";
import type {
  AccModule,
  CommandDefinition,
  ExportSectionDefinition,
  ModuleRoute,
  WidgetDefinition,
} from "./types";

export interface RegistryValidationIssue {
  moduleId: string;
  message: string;
}

/** Validates module manifests: unique ids, namespaced widget/section ids, unique routes. */
export function validateModules(modules: AccModule[]): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  const ids = new Set<string>();
  const routes = new Map<string, string>();
  const widgetIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const m of modules) {
    if (!/^[a-z][a-z0-9-]*$/.test(m.id))
      issues.push({ moduleId: m.id, message: "id must be kebab-case" });
    if (ids.has(m.id)) issues.push({ moduleId: m.id, message: "duplicate module id" });
    ids.add(m.id);
    if (!Array.isArray(m.exportSections))
      issues.push({ moduleId: m.id, message: "exportSections is required" });
    for (const r of m.routes ?? []) {
      const owner = routes.get(r.path);
      if (owner)
        issues.push({ moduleId: m.id, message: `route "${r.path}" already owned by ${owner}` });
      routes.set(r.path, m.id);
    }
    for (const w of m.widgets ?? []) {
      if (!w.id.startsWith(`${m.id}.`))
        issues.push({ moduleId: m.id, message: `widget "${w.id}" must be prefixed "${m.id}."` });
      if (widgetIds.has(w.id))
        issues.push({ moduleId: m.id, message: `duplicate widget "${w.id}"` });
      if (!w.sizes.includes(w.defaultSize))
        issues.push({ moduleId: m.id, message: `widget "${w.id}" defaultSize not in sizes` });
      widgetIds.add(w.id);
    }
    for (const s of m.exportSections ?? []) {
      if (!s.id.startsWith(`${m.id}.`))
        issues.push({
          moduleId: m.id,
          message: `export section "${s.id}" must be prefixed "${m.id}."`,
        });
      if (sectionIds.has(s.id))
        issues.push({ moduleId: m.id, message: `duplicate export section "${s.id}"` });
      sectionIds.add(s.id);
    }
  }
  return issues;
}

export function createRegistry(modules: AccModule[]) {
  const sorted = [...modules].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const issues = validateModules(sorted);
  if (issues.length) {
    throw new Error(
      "Invalid module registry:\n" + issues.map((i) => ` - ${i.moduleId}: ${i.message}`).join("\n"),
    );
  }

  const isEnabled = (m: AccModule, flags: Record<string, boolean>) =>
    m.featureFlag ? flags[m.featureFlag] !== false : true;

  return {
    modules: sorted,
    get(id: string) {
      return sorted.find((m) => m.id === id);
    },
    enabled(flags: Record<string, boolean> = {}) {
      return sorted.filter((m) => isEnabled(m, flags));
    },
    widgets(flags: Record<string, boolean> = {}): Array<WidgetDefinition & { moduleId: string }> {
      return sorted
        .filter((m) => isEnabled(m, flags))
        .flatMap((m) => (m.widgets ?? []).map((w) => ({ ...w, moduleId: m.id })));
    },
    widget(id: string) {
      for (const m of sorted) {
        const w = m.widgets?.find((x) => x.id === id);
        if (w) return w;
      }
      return undefined;
    },
    exportSections(
      flags: Record<string, boolean> = {},
    ): Array<ExportSectionDefinition & { moduleId: string }> {
      return sorted
        .filter((m) => isEnabled(m, flags))
        .flatMap((m) => m.exportSections.map((s) => ({ ...s, moduleId: m.id })));
    },
    commands(flags: Record<string, boolean> = {}): CommandDefinition[] {
      return sorted.filter((m) => isEnabled(m, flags)).flatMap((m) => m.commands ?? []);
    },
    /** Resolve a URL path (segments) to a module route; supports "[param]" segments. */
    matchRoute(
      segments: string[],
    ): { module: AccModule; route: ModuleRoute; params: Record<string, string> } | null {
      let best: { module: AccModule; route: ModuleRoute; params: Record<string, string> } | null =
        null;
      let bestDynamic = Infinity;
      for (const m of sorted) {
        for (const r of m.routes ?? []) {
          const parts = r.path.split("/").filter(Boolean);
          if (parts.length !== segments.length) continue;
          const params: Record<string, string> = {};
          let ok = true;
          let dynamic = 0;
          parts.forEach((p, i) => {
            const seg = segments[i];
            if (p.startsWith("[") && p.endsWith("]")) {
              params[p.slice(1, -1)] = decodeURIComponent(seg);
              dynamic++;
            } else if (p !== seg) ok = false;
          });
          // Static segments win over dynamic ones ("accounts/import" beats "accounts/[id]").
          if (ok && dynamic < bestDynamic) {
            best = { module: m, route: r, params };
            bestDynamic = dynamic;
          }
        }
      }
      return best;
    },
  };
}

export type Registry = ReturnType<typeof createRegistry>;

export const registry: Registry = createRegistry(discoveredModules);
