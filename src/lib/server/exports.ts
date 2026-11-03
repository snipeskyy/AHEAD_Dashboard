import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { buildDocument } from "@/lib/export/build";
import {
  ExportConfigSchema,
  FORMAT_META,
  type ExportConfig,
  type ExportFormat,
} from "@/lib/export/config";
import { documentToMarkdown } from "@/lib/export/markdown";
import { renderPdf } from "@/lib/export/pdf";
import { documentToPptx } from "@/lib/export/pptx";
import type { ExportDocument } from "@/lib/export/types";
import { logActivity } from "./activity";
import { HttpError } from "./http";

/** Generated files + document snapshots live here (git-ignored, local only). */
export const EXPORT_DIR = path.join(process.cwd(), "exports");
const safeId = (id: string) => {
  if (!/^[a-z0-9]+$/i.test(id)) throw new HttpError(400, "Bad export id");
  return id;
};
export const snapshotPath = (id: string) => path.join(EXPORT_DIR, `${safeId(id)}.json`);
export const outputPath = (id: string, format: ExportFormat) =>
  path.join(EXPORT_DIR, `${safeId(id)}.${FORMAT_META[format].ext}`);

export async function readSnapshot(id: string): Promise<ExportDocument | null> {
  try {
    return JSON.parse(await readFile(snapshotPath(id), "utf8")) as ExportDocument;
  } catch {
    return null;
  }
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "export";

/**
 * Builds a fresh, redacted document, snapshots it, and renders the requested format.
 * The PDF is printed from /print/export/<id>, which renders the snapshot — so the PDF is
 * exactly what was built, with no second data read.
 */
export async function createExport(rawConfig: unknown, format: ExportFormat, origin: string) {
  const config: ExportConfig = ExportConfigSchema.parse(rawConfig);
  const doc = await buildDocument(config, { mode: "apply", renderCharts: format === "pdf" });
  if (!doc.sections.length)
    throw new HttpError(
      400,
      "Nothing to export — every section was empty or removed for this audience",
    );
  const job = await db.exportJob.create({
    data: { title: config.title, config, format, status: "running", version: config.version },
  });
  await mkdir(EXPORT_DIR, { recursive: true });
  await writeFile(snapshotPath(job.id), JSON.stringify(doc));
  try {
    const out = outputPath(job.id, format);
    if (format === "markdown") await writeFile(out, documentToMarkdown(doc));
    else if (format === "pptx") await writeFile(out, await documentToPptx(doc));
    else {
      const left = [doc.title, doc.watermark].filter(Boolean).join(" · ");
      const right = [
        doc.dateStamp ? new Date(doc.generatedAt).toISOString().slice(0, 10) : null,
        `v${doc.version}`,
      ]
        .filter(Boolean)
        .join(" · ");
      await writeFile(out, await renderPdf(`${origin}/print/export/${job.id}`, { left, right }));
    }
    const done = await db.exportJob.update({
      where: { id: job.id },
      data: { status: "done", outputPath: path.basename(out) },
    });
    await logActivity({
      entityType: "workspace",
      entityId: job.id,
      action: "export.created",
      summary: `Exported "${config.title}" v${config.version} (${FORMAT_META[format].label}, ${config.audience === "customer" ? "customer-facing" : "internal"})`,
    });
    return {
      job: done,
      removedFields: doc.redaction.removedFields,
      removedSections: doc.redaction.removedSections,
    };
  } catch (e) {
    await db.exportJob.update({ where: { id: job.id }, data: { status: "failed" } });
    throw e instanceof HttpError
      ? e
      : new HttpError(500, `Export failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function rerunExport(id: string, origin: string) {
  const job = await db.exportJob.findUnique({ where: { id } });
  if (!job) throw new HttpError(404, "Export not found");
  const config = ExportConfigSchema.parse(job.config);
  return createExport(
    { ...config, version: Math.min(999, config.version + 1) },
    job.format as ExportFormat,
    origin,
  );
}

export async function deleteExport(id: string) {
  const job = await db.exportJob.delete({ where: { id } });
  await rm(snapshotPath(id), { force: true });
  if (job.outputPath)
    await rm(path.join(EXPORT_DIR, path.basename(job.outputPath)), { force: true });
}
