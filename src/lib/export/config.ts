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

/** Built-in templates (scope chosen at export time). */
export const DEFAULT_TEMPLATES: Array<{
  name: string;
  config: Omit<ExportConfig, "scope" | "title"> & { scopeType: ExportConfig["scope"]["type"] };
}> = [
  {
    name: "Account brief (internal)",
    config: {
      scopeType: "account",
      sections: [
        "exports.cover",
        "account-intel.overview",
        "account-intel.initiatives",
        "account-intel.buying-committee",
        "account-intel.whitespace",
        "signals.key-signals",
        "opportunities.pipeline",
        "demand-gen.recommended-plays",
        "account-intel.plan",
        "command-home.whats-changed",
      ],
      audience: "internal",
      hiddenFields: [],
      watermark: "INTERNAL ONLY",
      dateStamp: true,
      version: 1,
      preparedBy: "",
    },
  },
  {
    name: "Customer QBR (customer-facing)",
    config: {
      scopeType: "account",
      sections: [
        "exports.cover",
        "account-intel.overview",
        "account-intel.initiatives",
        "account-intel.whitespace",
        "signals.key-signals",
        "opportunities.pipeline",
        "demand-gen.engagement",
        "account-intel.plan",
      ],
      audience: "customer",
      hiddenFields: [],
      watermark: "",
      dateStamp: true,
      version: 1,
      preparedBy: "",
    },
  },
  {
    name: "Portfolio exec readout",
    config: {
      scopeType: "portfolio",
      sections: [
        "exports.cover",
        "command-home.kpis",
        "opportunities.forecast",
        "opportunities.pipeline",
        "account-intel.whitespace",
        "signals.key-signals",
        "demand-gen.engagement",
        "command-home.whats-changed",
      ],
      audience: "internal",
      hiddenFields: [],
      watermark: "INTERNAL ONLY",
      dateStamp: true,
      version: 1,
      preparedBy: "",
    },
  },
];
