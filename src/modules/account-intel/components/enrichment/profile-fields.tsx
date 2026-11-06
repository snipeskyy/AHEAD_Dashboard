"use client";
import { Lock, LockOpen, PenLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  displayValue,
  FIELD_DEFS,
  SECTION_LABELS,
  type FieldDef,
  type FieldSection,
} from "@/lib/enrich/fields";
import { useSetField, type AccountEnrichment, type FieldRow } from "../../hooks/use-enrichment";
import { SourceIndicator } from "./source-indicator";

const SHOWN: FieldSection[] = [
  "identity",
  "firmographics",
  "financials",
  "web",
  "network",
  "public-sector",
];

function editableText(def: FieldDef, v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
}

function FieldRowView({
  accountId,
  def,
  row,
}: {
  accountId: string;
  def: FieldDef;
  row?: FieldRow;
}) {
  const set = useSetField(accountId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(editableText(def, row?.value));
  const structured = def.kind === "json" || (row && typeof row.value === "object");
  const save = () =>
    set.mutate({ field: def.id, value: text }, { onSuccess: () => setEditing(false) });
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] items-start gap-3 py-1.5 text-[13px]">
      <dt className="text-muted-foreground pt-0.5">{def.label}</dt>
      <dd className="min-w-0">
        {editing ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {def.kind === "text" && text.length > 60 ? (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                aria-label={def.label}
              />
            ) : (
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-7"
                aria-label={def.label}
                autoFocus
              />
            )}
            <Button type="submit" size="sm" className="h-7" disabled={set.isPending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <div className="group flex flex-wrap items-center gap-1.5">
            <span className={row ? "break-words" : "text-muted-foreground"}>
              {row && typeof row.value === "string" && /^https?:\/\//.test(row.value) ? (
                <a
                  href={row.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {row.value.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              ) : row ? (
                displayValue(def.id, row.value)
              ) : (
                "Not found yet"
              )}
            </span>
            {row && (
              <SourceIndicator
                source={row.source}
                sourceUrl={row.sourceUrl}
                confidence={row.confidence}
                fetchedAt={row.fetchedAt}
                locked={row.locked}
              />
            )}
            {!structured && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Edit ${def.label}`}
                onClick={() => {
                  setText(editableText(def, row?.value));
                  setEditing(true);
                }}
              >
                <PenLine className="size-3" />
              </Button>
            )}
            {row && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={
                  row.locked
                    ? `Unlock ${def.label} (allow enrichment updates)`
                    : `Lock ${def.label}`
                }
                onClick={() => set.mutate({ field: def.id, locked: !row.locked })}
              >
                {row.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              </Button>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}

/** Every enrichable field by section, with provenance, inline manual edit (locks it) and lock toggle. */
export function ProfileFields({ accountId, d }: { accountId: string; d: AccountEnrichment }) {
  const byField = new Map(d.fields.map((f) => [f.field, f]));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SHOWN.map((section) => {
        const defs = FIELD_DEFS.filter(
          (f) => f.section === section && (byField.has(f.id) || f.weight.Strategic > 0),
        );
        if (!defs.length) return null;
        return (
          <section
            key={section}
            className="bg-card rounded-lg border p-4"
            aria-labelledby={`sec-${section}`}
          >
            <h2 id={`sec-${section}`} className="mb-1 text-sm font-semibold">
              {SECTION_LABELS[section]}
            </h2>
            <dl className="divide-y">
              {defs.map((def) => (
                <FieldRowView
                  key={`${def.id}:${byField.get(def.id)?.updatedAt ?? ""}`}
                  accountId={accountId}
                  def={def}
                  row={byField.get(def.id)}
                />
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
