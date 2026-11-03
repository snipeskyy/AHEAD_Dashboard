import "server-only";
import { db } from "@/lib/db";
import { discoveredBuilders } from "@/modules/_generated.server";
import { registry } from "@/modules/registry";
import { HttpError } from "@/lib/server/http";
import type { BuildAccount } from "./builder-types";
import { renderChartSvg } from "./chart-svg";
import type { ExportConfig } from "./config";
import { applyRedaction } from "./redaction";
import type { DocSection, ExportDocument } from "./types";

export async function resolveScope(config: ExportConfig): Promise<BuildAccount[]> {
  const select = { id: true, name: true, tier: true, industry: true, isDemo: true } as const;
  if (config.scope.type === "portfolio")
    return db.account.findMany({ select, orderBy: [{ tier: "asc" }, { name: "asc" }] });
  if (!config.scope.accountIds.length) throw new HttpError(400, "Choose at least one account");
  const rows = await db.account.findMany({
    where: { id: { in: config.scope.accountIds } },
    select,
  });
  const order = new Map(config.scope.accountIds.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Builds the executive-summary document: runs each enabled section's builder (from the module
 * registry), applies redaction for the audience, and renders charts to SVG.
 */
export async function buildDocument(
  config: ExportConfig,
  opts: { mode: "apply" | "preview"; renderCharts?: boolean } = { mode: "apply" },
): Promise<ExportDocument> {
  const now = new Date();
  const accounts = await resolveScope(config);
  const defs = registry.exportSections();
  const sections: DocSection[] = [];
  for (const id of config.sections) {
    const def = defs.find((d) => d.id === id);
    const build = discoveredBuilders[id];
    if (!def || !build || def.status === "stub") continue;
    const blocks = await build({
      db,
      scope: config.scope.type,
      accounts,
      now,
      audience: config.audience,
    });
    sections.push({
      id,
      moduleId: def.moduleId,
      title: def.title,
      internalOnly: def.internalOnly,
      blocks,
    });
  }
  const red = applyRedaction(sections, defs, {
    audience: config.audience,
    hiddenFields: config.hiddenFields,
    mode: opts.mode,
  });
  if (opts.renderCharts !== false) {
    for (const s of red.sections)
      for (const b of s.blocks)
        if (b.kind === "chart" && !b.redacted) b.svg = renderChartSvg(b.spec);
  }
  const scopeLabel =
    config.scope.type === "portfolio"
      ? `Portfolio · ${accounts.length} accounts`
      : accounts.length === 1
        ? accounts[0].name
        : `${accounts.length} accounts`;
  return {
    title: config.title,
    subtitle: config.audience === "customer" ? "Executive summary" : "Executive summary — internal",
    scopeLabel,
    audience: config.audience,
    generatedAt: now.toISOString(),
    version: config.version,
    watermark: config.watermark,
    dateStamp: config.dateStamp,
    preparedBy: config.preparedBy,
    isDemo: accounts.some((a) => a.isDemo),
    sections: red.sections,
    redaction: {
      removedFields: red.removedFields,
      removedSections: red.removedSections,
      mode: opts.mode,
    },
  };
}
