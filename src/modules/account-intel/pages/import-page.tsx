"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileUp, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import {
  autoMapHeaders,
  IMPORT_FIELDS,
  normalizeImportRow,
  type ImportFieldId,
} from "@/lib/import/normalize";
import { cn } from "@/lib/utils";

interface Parsed {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

interface ImportResult {
  created: Array<{ id: string; name: string }>;
  skipped: Array<{ row: number; name: string; reason: string }>;
}

const selectCls =
  "h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export default function ImportPage() {
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldId, string>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFile = (file: File) => {
    if (file.size > 2_000_000) return toast.error("File is larger than 2 MB");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (r) => {
        const headers = (r.meta.fields ?? []).filter(Boolean);
        if (!headers.length) return toast.error("No header row found");
        setParsed({ fileName: file.name, headers, rows: r.data.slice(0, 2000) });
        setMapping(autoMapHeaders(headers));
        setResult(null);
      },
      error: (e) => toast.error(e.message),
    });
  };

  const mappedRows = useMemo(
    () =>
      parsed
        ? parsed.rows.map((row) =>
            Object.fromEntries(
              Object.entries(mapping).map(([field, header]) => [
                field,
                header ? row[header] : undefined,
              ]),
            ),
          )
        : [],
    [parsed, mapping],
  );
  const validation = useMemo(() => mappedRows.map((r) => normalizeImportRow(r)), [mappedRows]);
  const validCount = validation.filter((v) => v.ok).length;

  const run = useMutation({
    mutationFn: () =>
      api<ImportResult>("/api/accounts/import", { method: "POST", json: { rows: mappedRows } }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Imported ${r.created.length} account${r.created.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow={
          <Link href="/accounts" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Accounts
          </Link>
        }
        title="Import target accounts"
        description="Upload a CSV of your own target accounts. Only public identifiers are used — name, domain, ticker — and accounts are enriched exclusively from public sources."
      />

      <div className="border-good/30 bg-good/5 flex items-start gap-3 rounded-lg border p-4 text-[13px]">
        <ShieldCheck className="text-good-text mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Don&apos;t upload CRM exports, pricing, contract or other internal data. Imported accounts
          start with <strong>no generated intelligence</strong>: initiatives and tech-stack items
          appear only from public sources (with links) or when you enter them as hypotheses.
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={cn(
          "bg-card hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          dragOver && "border-primary bg-brand-soft",
        )}
      >
        <FileUp className="text-muted-foreground size-6" aria-hidden />
        <span className="text-sm font-medium">
          {parsed ? parsed.fileName : "Drop a CSV here or click to choose a file"}
        </span>
        <span className="text-muted-foreground text-xs">
          Columns like Company, Website, Ticker, Industry, Tier · up to 2,000 rows · see
          examples/target-accounts.csv
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          data-testid="csv-input"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>

      {parsed && (
        <section className="bg-card grid gap-4 rounded-lg border p-5">
          <div>
            <h2 className="text-sm font-semibold">Map columns</h2>
            <p className="text-muted-foreground text-xs">
              We matched what we could. Unmapped fields are left empty.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((f) => (
              <div key={f.id} className="grid gap-1.5">
                <Label htmlFor={`map-${f.id}`}>
                  {f.label} {f.required && <span className="text-critical-text">*</span>}
                </Label>
                <select
                  id={`map-${f.id}`}
                  className={selectCls}
                  value={mapping[f.id] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.id]: e.target.value || undefined })}
                >
                  <option value="">— not mapped —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Import preview</caption>
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Domain
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Ticker
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Tier
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {validation.slice(0, 50).map((v, i) => (
                  <tr key={i} className="border-t">
                    <td className="text-muted-foreground tabular px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      {v.ok ? v.value.name : String(mappedRows[i].name ?? "")}
                    </td>
                    <td className="text-muted-foreground px-3 py-1.5">
                      {v.ok ? (v.value.domain ?? "—") : ""}
                    </td>
                    <td className="text-muted-foreground px-3 py-1.5">
                      {v.ok ? (v.value.ticker ?? "—") : ""}
                    </td>
                    <td className="text-muted-foreground px-3 py-1.5">
                      {v.ok ? v.value.tier : ""}
                    </td>
                    <td className="px-3 py-1.5">
                      {v.ok ? (
                        <span className="text-good-text inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" /> Ready
                        </span>
                      ) : (
                        <span className="text-critical-text inline-flex items-center gap-1">
                          <XCircle className="size-3.5" /> {v.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 50 && (
            <p className="text-muted-foreground text-xs">
              Showing first 50 of {parsed.rows.length} rows.
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <span className="text-muted-foreground text-xs">
              {validCount} of {parsed.rows.length} rows ready
            </span>
            <Button
              disabled={!mapping.name || !validCount || run.isPending}
              onClick={() => run.mutate()}
            >
              Import {validCount} account{validCount === 1 ? "" : "s"}
            </Button>
          </div>
        </section>
      )}

      {result && (
        <section className="bg-card grid gap-3 rounded-lg border p-5" aria-live="polite">
          <h2 className="text-sm font-semibold">Import complete</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-good-text">
              {result.created.length} created
            </Badge>
            <Badge variant="outline">{result.skipped.length} skipped</Badge>
          </div>
          {result.created.length > 0 && (
            <ul className="grid gap-1 text-[13px]">
              {result.created.map((c) => (
                <li key={c.id}>
                  <Link href={`/accounts/${c.id}`} className="text-primary hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {result.skipped.length > 0 && (
            <ul className="text-muted-foreground grid gap-1 text-xs">
              {result.skipped.map((s) => (
                <li key={s.row}>
                  Row {s.row} ({s.name || "unnamed"}): {s.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageContainer>
  );
}
