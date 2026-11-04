"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { KIND_DEFS } from "@/lib/import/kinds";
import { applyMapping, mappingFits, type ColumnMapping } from "@/lib/import/mapping";
import type { ImportKind } from "@/lib/import/types";
import type { SourceTable } from "./source-step";

const selectCls =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const PREVIEW_ROWS = 20;

interface SavedMapping {
  id: string;
  name: string;
  mapping: ColumnMapping;
}

/** Step 3: map columns (auto-matched, saved mappings), preview the first 20 rows with row-level errors. */
export function MappingStep({
  kind,
  table,
  mapping,
  onMappingChange,
  onBack,
  onNext,
}: {
  kind: ImportKind;
  table: SourceTable;
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const def = KIND_DEFS[kind];
  const qc = useQueryClient();
  const [saveName, setSaveName] = useState("");
  const saved = useQuery({
    queryKey: ["import-mappings", kind],
    queryFn: () =>
      api<{ items: SavedMapping[] }>(`/api/import/mappings?kind=${kind}`).then((r) => r.items),
  });
  const save = useMutation({
    mutationFn: () =>
      api("/api/import/mappings", {
        method: "POST",
        json: { kind, name: saveName.trim(), mapping },
      }),
    onSuccess: () => {
      toast.success("Mapping saved");
      setSaveName("");
      qc.invalidateQueries({ queryKey: ["import-mappings", kind] });
    },
    onError: (e) => toast.error(e.message),
  });

  const fitting = (saved.data ?? []).filter((m) => mappingFits(m.mapping, table.headers));
  const mapped = useMemo(() => applyMapping(table.rows, mapping), [table.rows, mapping]);
  const checks = useMemo(() => mapped.map((r) => def.normalize(r)), [mapped, def]);
  const errorCount = checks.filter((c) => !c.ok).length;
  const missingRequired = def.fields.filter((f) => f.required && !mapping[f.id]);
  const cols = def.fields.filter((f) => mapping[f.id]);

  return (
    <div className="grid gap-4">
      <section className="bg-card grid gap-3 rounded-lg border p-4" aria-labelledby="map-h">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="map-h" className="text-sm font-semibold">
              Map columns
            </h2>
            <p className="text-muted-foreground text-xs">
              {table.fileName ?? "Pasted rows"} · {table.rows.length.toLocaleString()} rows ·{" "}
              {table.headers.length} columns. Matched columns are filled in automatically.
            </p>
          </div>
          {fitting.length > 0 && (
            <select
              aria-label="Apply a saved mapping"
              className={`${selectCls} w-56`}
              value=""
              onChange={(e) => {
                const m = fitting.find((x) => x.id === e.target.value);
                if (m) onMappingChange(m.mapping);
              }}
            >
              <option value="">Apply a saved mapping…</option>
              {fitting.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </header>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {def.fields.map((f) => (
            <label key={f.id} className="grid gap-1 text-[13px]">
              <span className="flex items-center gap-1.5">
                {f.label}
                {f.required && <span className="text-critical-text text-xs">required</span>}
              </span>
              <select
                className={selectCls}
                value={mapping[f.id] ?? ""}
                aria-label={`Column for ${f.label}`}
                onChange={(e) =>
                  onMappingChange({ ...mapping, [f.id]: e.target.value || undefined })
                }
              >
                <option value="">— not imported —</option>
                {table.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              {f.hint && <span className="text-muted-foreground text-xs">{f.hint}</span>}
            </label>
          ))}
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (saveName.trim()) save.mutate();
          }}
        >
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this mapping to reuse it"
            aria-label="Mapping name"
            className="h-8 w-64"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!saveName.trim() || save.isPending}
          >
            <Save /> Save mapping
          </Button>
        </form>
      </section>

      <section className="bg-card grid gap-2 rounded-lg border p-4" aria-labelledby="prev-h">
        <header className="flex flex-wrap items-center gap-2">
          <h2 id="prev-h" className="text-sm font-semibold">
            Preview (first {Math.min(PREVIEW_ROWS, mapped.length)} rows)
          </h2>
          {errorCount ? (
            <Badge variant="outline" className="text-critical-text gap-1 font-normal">
              <AlertCircle className="size-3" aria-hidden /> {errorCount} row
              {errorCount === 1 ? "" : "s"} with errors (will be skipped)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-good-text gap-1 font-normal">
              <CheckCircle2 className="size-3" aria-hidden /> All rows valid
            </Badge>
          )}
        </header>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Import preview">
          <table className="w-full text-left text-[13px]">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="py-1.5 pr-3 font-medium">#</th>
                {cols.map((f) => (
                  <th key={f.id} className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
                <th className="py-1.5 font-medium">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mapped.slice(0, PREVIEW_ROWS).map((r, i) => {
                const c = checks[i];
                const bad = new Set(c.ok ? [] : c.errors.map((e) => e.field));
                return (
                  <tr key={i} className={c.ok ? undefined : "bg-critical/5"}>
                    <td className="text-muted-foreground py-1.5 pr-3 tabular-nums">{i + 1}</td>
                    {cols.map((f) => (
                      <td
                        key={f.id}
                        className={`max-w-56 truncate py-1.5 pr-3 ${bad.has(f.id) ? "text-critical-text font-medium" : ""}`}
                      >
                        {r[f.id] || "—"}
                      </td>
                    ))}
                    <td className="py-1.5 text-xs">
                      {c.ok ? (
                        <span className="text-good-text inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3" aria-hidden /> OK
                        </span>
                      ) : (
                        <span className="text-critical-text inline-flex items-center gap-1">
                          <AlertCircle className="size-3 shrink-0" aria-hidden />
                          {c.errors.map((e) => e.message).join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {missingRequired.length > 0 && (
            <span className="text-critical-text text-xs" role="status">
              Map required: {missingRequired.map((f) => f.label).join(", ")}
            </span>
          )}
          <Button size="sm" disabled={missingRequired.length > 0} onClick={onNext}>
            Check for duplicates
          </Button>
        </div>
      </div>
    </div>
  );
}
