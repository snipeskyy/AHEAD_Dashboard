"use client";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  MEDDPICC_KEYS,
  MEDDPICC_LABELS,
  type Meddpicc,
  type MeddpiccKey,
  type Stage,
} from "@/lib/domain/enums";
import { meddpiccCompleteness, meddpiccRedFlags } from "@/lib/scoring/meddpicc";
import { cn } from "@/lib/utils";
import { MeddpiccMeter } from "./badges";

const STATUSES = [
  { value: "unknown", label: "Unknown" },
  { value: "partial", label: "Partial" },
  { value: "confirmed", label: "Confirmed" },
] as const;

const HINTS: Record<MeddpiccKey, string> = {
  metrics: "Quantified business outcome the customer expects",
  economicBuyer: "Person with final budget authority",
  decisionCriteria: "How they will evaluate options",
  decisionProcess: "Steps, people and timeline to a decision",
  paperProcess: "Legal, procurement and security review path",
  identifyPain: "The business pain driving urgency",
  champion: "Internal advocate with influence who sells for you",
  competition: "Alternatives, including do-nothing",
};

/** MEDDPICC editor with live completeness score and stage-aware red flags. */
export function MeddpiccPanel({
  value,
  stage,
  onChange,
}: {
  value: Meddpicc;
  stage: Stage;
  onChange: (m: Meddpicc) => void;
}) {
  const score = meddpiccCompleteness(value);
  const flags = meddpiccRedFlags(value, stage);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">MEDDPICC</h3>
        <MeddpiccMeter score={score} />
      </div>
      {flags.length > 0 && (
        <ul className="border-critical/30 bg-critical/5 text-critical-text grid gap-1 rounded-md border p-2.5 text-xs">
          {flags.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {f}
            </li>
          ))}
        </ul>
      )}
      <ul className="grid gap-2.5">
        {MEDDPICC_KEYS.map((k) => (
          <MeddpiccRow
            key={k}
            k={k}
            field={value[k]}
            onChange={(f) => onChange({ ...value, [k]: f })}
          />
        ))}
      </ul>
    </div>
  );
}

function MeddpiccRow({
  k,
  field,
  onChange,
}: {
  k: MeddpiccKey;
  field: Meddpicc[MeddpiccKey];
  onChange: (f: Meddpicc[MeddpiccKey]) => void;
}) {
  const [notes, setNotes] = useState(field.notes);
  return (
    <li className="rounded-md border p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13px] font-medium">{MEDDPICC_LABELS[k]}</div>
          <div className="text-muted-foreground text-[11px]">{HINTS[k]}</div>
        </div>
        <div
          role="radiogroup"
          aria-label={`${MEDDPICC_LABELS[k]} status`}
          className="flex rounded-md border p-0.5"
        >
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={field.status === s.value}
              onClick={() => onChange({ ...field, status: s.value })}
              className={cn(
                "text-muted-foreground hover:text-foreground rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                field.status === s.value && s.value === "confirmed" && "bg-good/15 text-good-text",
                field.status === s.value &&
                  s.value === "partial" &&
                  "bg-warning/20 text-warning-text",
                field.status === s.value && s.value === "unknown" && "bg-muted text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <input
        aria-label={`${MEDDPICC_LABELS[k]} notes`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== field.notes && onChange({ ...field, notes })}
        placeholder="Evidence / notes…"
        className="bg-muted/50 focus:border-ring focus:bg-background mt-2 h-7 w-full rounded border border-transparent px-2 text-xs outline-none"
      />
    </li>
  );
}
