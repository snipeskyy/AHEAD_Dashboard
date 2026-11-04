"use client";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Building2, Handshake, NotebookPen, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { KIND_DEFS } from "@/lib/import/kinds";
import { applyMapping, autoMap, type ColumnMapping } from "@/lib/import/mapping";
import { IMPORT_KINDS, type ImportKind } from "@/lib/import/types";
import { cn } from "@/lib/utils";
import { MappingStep } from "./mapping-step";
import { ResultStep } from "./result-step";
import { ReviewStep, type CommitResult } from "./review-step";
import { SourceStep, type SourceTable } from "./source-step";

const ICONS = {
  accounts: Building2,
  contacts: Users,
  opportunities: Briefcase,
  notes: NotebookPen,
  "partner-reps": Handshake,
};
const STEPS = ["Type", "Source", "Map columns", "Review", "Done"] as const;

/** Import wizard: type → source (file / paste) → map → review duplicates → done (undoable). */
export function ImportWizard({
  initialKind,
  onKindChange,
}: {
  initialKind: ImportKind;
  onKindChange: (k: ImportKind) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [table, setTable] = useState<SourceTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [result, setResult] = useState<CommitResult | null>(null);
  const rows = useMemo(() => (table ? applyMapping(table.rows, mapping) : []), [table, mapping]);
  const current = result ? 4 : step;

  const reset = () => {
    setTable(null);
    setMapping({});
    setResult(null);
    setStep(1);
  };

  return (
    <div className="grid gap-4">
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "rounded-full border px-2.5 py-1",
              i === current
                ? "border-primary text-primary font-medium"
                : i < current
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <fieldset className="grid gap-2" disabled={!!result}>
        <legend className="sr-only">What are you importing?</legend>
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-5"
          role="radiogroup"
          aria-label="What are you importing?"
        >
          {IMPORT_KINDS.map((k) => {
            const Icon = ICONS[k];
            const active = k === kind;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setKind(k);
                  onKindChange(k);
                  setTable(null);
                  setMapping({});
                  setStep(1);
                }}
                className={cn(
                  "bg-card focus-visible:ring-ring flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] focus-visible:ring-2 focus-visible:outline-none",
                  active ? "border-primary ring-primary/20 ring-2" : "hover:bg-muted/50",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="font-medium">{KIND_DEFS[k].label}</span>
              </button>
            );
          })}
        </div>
        {kind !== "accounts" && kind !== "partner-reps" && (
          <p className="text-muted-foreground text-xs">
            Each row must name an account that already exists in ACC (by domain or name). Import
            accounts first.
          </p>
        )}
      </fieldset>

      {result ? (
        <ResultStep kind={kind} result={result} onAgain={reset} />
      ) : step === 1 || !table ? (
        <SourceStep
          key={kind}
          kind={kind}
          onLoaded={(t) => {
            setTable(t);
            setMapping(autoMap(KIND_DEFS[kind].fields, t.headers));
            setStep(2);
          }}
        />
      ) : step === 2 ? (
        <MappingStep
          kind={kind}
          table={table}
          mapping={mapping}
          onMappingChange={setMapping}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : (
        <ReviewStep
          kind={kind}
          rows={rows}
          fileName={table.fileName}
          inputType={table.inputType}
          onBack={() => setStep(2)}
          onDone={(r) => {
            setResult(r);
            qc.invalidateQueries();
          }}
        />
      )}
    </div>
  );
}
