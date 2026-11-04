"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CopyCheck, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/states";
import { StatTile } from "@/components/kpi/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { KIND_DEFS } from "@/lib/import/kinds";
import type { ImportKind, InputType, MappedRow } from "@/lib/import/types";
import type { Decision, PreviewRow } from "@/lib/server/import/plan";

export interface CommitResult {
  batchId: string;
  counts: { created: number; merged: number; skipped: number; errors: number };
  createdAccounts: string[];
}

const LABEL: Record<Decision, string> = {
  merge: "Merge into existing",
  skip: "Skip",
  create: "Create anyway",
};
const BY: Record<string, string> = {
  domain: "same domain",
  name: "same name",
  file: "repeated in this file",
  key: "already exists",
};

/** Step 4: server-side check: validation, account matching, duplicates → merge / skip / create. */
export function ReviewStep({
  kind,
  rows,
  fileName,
  inputType,
  onBack,
  onDone,
}: {
  kind: ImportKind;
  rows: MappedRow[];
  fileName: string | null;
  inputType: InputType;
  onBack: () => void;
  onDone: (r: CommitResult) => void;
}) {
  const def = KIND_DEFS[kind];
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const preview = useQuery({
    queryKey: ["import-preview", kind, rows],
    queryFn: () =>
      api<{
        summary: { total: number; new: number; duplicate: number; error: number };
        rows: PreviewRow[];
      }>("/api/import/preview", { method: "POST", json: { kind, rows } }),
    staleTime: Infinity,
  });
  const commit = useMutation({
    mutationFn: () =>
      api<CommitResult>("/api/import/commit", {
        method: "POST",
        json: { kind, rows, decisions, fileName, inputType },
      }),
    onSuccess: onDone,
    onError: (e) => toast.error(e.message),
  });

  if (preview.isLoading) return <Skeleton className="h-72" />;
  if (preview.error || !preview.data)
    return <ErrorState error={preview.error} onRetry={() => preview.refetch()} />;
  const { summary } = preview.data;
  const all = preview.data.rows;
  const decide = (r: PreviewRow) => decisions[r.index] ?? r.defaultDecision;
  const dups = all.filter((r) => r.status === "duplicate");
  const errors = all.filter((r) => r.status === "error");
  const warnings = all.filter((r) => r.warnings.length);
  const willCreate = all.filter((r) => r.status !== "error" && decide(r) === "create").length;
  const willMerge = dups.filter((r) => decide(r) === "merge").length;
  const setAll = (d: Decision) =>
    setDecisions(
      Object.fromEntries(dups.filter((r) => r.options.includes(d)).map((r) => [r.index, d])),
    );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Rows" value={summary.total.toLocaleString()} />
        <StatTile label={`New ${def.label.toLowerCase()}`} value={summary.new.toLocaleString()} />
        <StatTile
          label="Possible duplicates"
          value={summary.duplicate.toLocaleString()}
          tone={summary.duplicate ? "warning" : undefined}
          sub={summary.duplicate ? "choose below" : undefined}
        />
        <StatTile
          label="Errors (skipped)"
          value={summary.error.toLocaleString()}
          tone={summary.error ? "critical" : undefined}
        />
      </div>

      {dups.length > 0 && (
        <section className="bg-card grid gap-2 rounded-lg border p-4" aria-labelledby="dup-h">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="dup-h" className="flex items-center gap-1.5 text-sm font-semibold">
              <CopyCheck className="size-4" aria-hidden /> Possible duplicates
            </h2>
            <div className="flex gap-1.5">
              {(["merge", "skip", "create"] as const).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setAll(d)}
                >
                  {d === "merge" ? "Merge all" : d === "skip" ? "Skip all" : "Create all"}
                </Button>
              ))}
            </div>
          </header>
          <p className="text-muted-foreground text-xs">
            Matched on domain first, then on the normalized legal name. Merging only fills in or
            updates fields that have a value in your file; blank cells never erase data.
          </p>
          <ul className="divide-y">
            {dups.map((r) => (
              <li key={r.index} className="grid gap-2 py-2 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0 text-[13px]">
                  <div className="font-medium">
                    Row {r.index + 1}: {r.label}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Matches <span className="text-foreground">{r.match?.name}</span> (
                    {BY[r.match?.by ?? "key"]})
                  </div>
                  {r.diff.length > 0 ? (
                    <ul className="mt-1 grid gap-0.5 text-xs">
                      {r.diff.map((d) => (
                        <li key={d.field}>
                          <span className="text-muted-foreground">{d.label}:</span> {d.current} →{" "}
                          <span className="font-medium">{d.incoming}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    r.match?.by !== "file" && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        Nothing new to merge.
                      </div>
                    )
                  )}
                </div>
                <select
                  aria-label={`Decision for row ${r.index + 1}`}
                  className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm"
                  value={decide(r)}
                  onChange={(e) =>
                    setDecisions({ ...decisions, [r.index]: e.target.value as Decision })
                  }
                >
                  {r.options.map((o) => (
                    <option key={o} value={o}>
                      {LABEL[o]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {errors.length > 0 && (
        <section className="bg-card grid gap-2 rounded-lg border p-4" aria-labelledby="err-h">
          <h2
            id="err-h"
            className="text-critical-text flex items-center gap-1.5 text-sm font-semibold"
          >
            <AlertCircle className="size-4" aria-hidden /> {errors.length} row
            {errors.length === 1 ? "" : "s"} will be skipped
          </h2>
          <ul className="grid max-h-64 gap-1 overflow-y-auto text-xs">
            {errors.map((r) => (
              <li key={r.index}>
                <span className="font-medium">Row {r.index + 1}</span> ({r.label}):{" "}
                {r.errors.map((e) => e.message).join("; ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {warnings.length > 0 && (
        <section
          className="grid gap-1 rounded-lg border border-dashed p-3 text-xs"
          aria-label="Warnings"
        >
          {warnings.map((r) => (
            <p key={r.index} className="text-warning-text flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden /> Row {r.index + 1}:{" "}
              {r.warnings.join("; ")}
            </p>
          ))}
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          disabled={commit.isPending || willCreate + willMerge === 0}
          onClick={() => commit.mutate()}
        >
          <Plus />
          {commit.isPending
            ? "Importing…"
            : `Import: create ${willCreate}${willMerge ? `, merge ${willMerge}` : ""}`}
        </Button>
      </div>
    </div>
  );
}
