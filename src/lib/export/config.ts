import { z } from "zod";

export const ExportConfigSchema = z.object({
  title: z.string().trim().min(1).max(160),
  scope: z.object({
    type: z.enum(["account", "accounts", "portfolio"]),
    accountIds: z.array(z.string()).max(50).default([]),
  }),
  /** Enabled sections, in display order. */
  sections: z.array(z.string()).min(1).max(40),
  audience: z.enum(["internal", "customer"]),
  /** Extra per-field redactions: "<sectionId>.<fieldId>". */
  hiddenFields: z.array(z.string()).max(300).default([]),
  watermark: z.string().trim().max(40).default(""),
  dateStamp: z.boolean().default(true),
  version: z.number().int().min(1).max(999).default(1),
  preparedBy: z.string().trim().max(80).default(""),
  /** Phase 10: "deck" = 16:9 slides (PPTX always uses slides; PDF follows this). */
  style: z.enum(["document", "deck"]).default("document"),
  /** "brand" uses the local brand pack when installed (else neutral). */
  theme: z.enum(["brand", "neutral"]).default("brand"),
  deck: z
    .object({
      agenda: z.boolean().default(true),
      dividers: z.boolean().default(false),
      closing: z.boolean().default(true),
      hiddenSlides: z.array(z.string().max(120)).max(200).default([]),
      notes: z.record(z.string().max(120), z.string().max(4000)).default({}),
    })
    .default({ agenda: true, dividers: false, closing: true, hiddenSlides: [], notes: {} }),
});
export type ExportConfig = z.infer<typeof ExportConfigSchema>;

export const EXPORT_FORMATS = ["pdf", "markdown", "pptx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const FORMAT_META: Record<ExportFormat, { ext: string; mime: string; label: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf", label: "PDF" },
  markdown: { ext: "md", mime: "text/markdown; charset=utf-8", label: "Markdown" },
  pptx: {
    ext: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
  },
};

type TemplateConfig = Omit<ExportConfig, "scope" | "title"> & {
  scopeType: ExportConfig["scope"]["type"];
};

const tpl = (
  name: string,
  scopeType: TemplateConfig["scopeType"],
  sections: string[],
  o: Partial<Omit<TemplateConfig, "scopeType" | "sections">> = {},
): { name: string; config: TemplateConfig } => ({
  name,
  config: {
    scopeType,
    sections,
    audience: "internal",
    hiddenFields: [],
    watermark: o.audience === "customer" ? "" : "INTERNAL ONLY",
    dateStamp: true,
    version: 1,
    preparedBy: "",
    style: "document",
    theme: "brand",
    deck: { agenda: true, dividers: false, closing: true, hiddenSlides: [], notes: {} },
    ...o,
  },
});

/** Built-in templates (scope chosen at export time). Installed by name, so new ones reach existing workspaces. */
export const DEFAULT_TEMPLATES: Array<{ name: string; config: TemplateConfig }> = [
  tpl("Account brief (internal)", "account", [
    "exports.cover",
    "exports.exec-summary",
    "account-intel.overview",
    "account-intel.initiatives",
    "account-intel.buying-committee",
    "account-intel.whitespace",
    "signals.key-signals",
    "opportunities.pipeline",
    "demand-gen.recommended-plays",
    "account-intel.plan",
    "exports.next-steps",
  ]),
  tpl(
    "Customer QBR deck (customer-facing)",
    "account",
    [
      "exports.cover",
      "exports.exec-summary",
      "account-intel.initiatives",
      "account-intel.whitespace",
      "signals.key-signals",
      "opportunities.pipeline",
      "demand-gen.engagement",
      "account-intel.plan",
      "exports.next-steps",
    ],
    { audience: "customer", watermark: "", style: "deck" },
  ),
  tpl("Executive summary (one page)", "account", ["exports.exec-summary", "exports.next-steps"], {
    watermark: "",
  }),
  tpl(
    "Executive summary deck (customer-facing)",
    "account",
    [
      "exports.cover",
      "exports.exec-summary",
      "account-intel.initiatives",
      "account-intel.whitespace",
      "exports.next-steps",
    ],
    {
      audience: "customer",
      watermark: "",
      style: "deck",
      deck: { agenda: false, dividers: false, closing: true, hiddenSlides: [], notes: {} },
    },
  ),
  tpl("Account plan", "account", [
    "exports.cover",
    "account-intel.overview",
    "account-intel.plan",
    "account-intel.buying-committee",
    "account-intel.whitespace",
    "exports.next-steps",
  ]),
  tpl(
    "TCO business case deck (customer-facing)",
    "account",
    ["exports.cover", "exports.exec-summary", "business-cases.tco", "exports.next-steps"],
    { audience: "customer", watermark: "", style: "deck" },
  ),
  tpl("Meeting prep brief", "account", ["account-intel.brief"], { watermark: "" }),
  tpl(
    "Partner co-sell brief (internal)",
    "account",
    [
      "exports.cover",
      "exports.exec-summary",
      "partners.co-sell",
      "opportunities.pipeline",
      "exports.next-steps",
    ],
    { style: "deck" },
  ),
  tpl(
    "Portfolio exec readout",
    "portfolio",
    [
      "exports.cover",
      "exports.exec-summary",
      "command-home.kpis",
      "opportunities.forecast",
      "opportunities.pipeline",
      "account-intel.whitespace",
      "signals.key-signals",
      "demand-gen.engagement",
      "command-home.whats-changed",
    ],
    {
      style: "deck",
      deck: { agenda: true, dividers: true, closing: true, hiddenSlides: [], notes: {} },
    },
  ),
];
