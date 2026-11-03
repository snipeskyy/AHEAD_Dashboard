import { notFound } from "next/navigation";
import { DocumentView } from "@/components/export/document-view";
import { readSnapshot } from "@/lib/server/exports";

export const dynamic = "force-dynamic";

/** Print-only route rendered by headless Chromium for PDF export. Renders the stored snapshot. */
export default async function PrintExport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await readSnapshot(id).catch(() => null);
  if (!doc) notFound();
  return (
    <main className="min-h-screen bg-white" data-print-ready="true">
      <style>{`@page { size: Letter; } html, body { background: #fff !important; } .export-doc { font-size: 13px; } section { break-inside: auto; } figure, tr { break-inside: avoid; }`}</style>
      <DocumentView doc={doc} print />
    </main>
  );
}
