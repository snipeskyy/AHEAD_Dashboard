"use client";
import { useMemo, useState } from "react";
import type { ZodObject, ZodRawShape } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { describeSchema } from "@/lib/schema-form";
import { SettingsRow } from "./section";

/** Auto-generated settings form for a module's Zod settingsSchema. */
export function SchemaForm({
  schema,
  value,
  onSave,
}: {
  schema: ZodObject<ZodRawShape>;
  value: Record<string, unknown>;
  onSave: (v: Record<string, unknown>) => void;
}) {
  const fields = useMemo(() => describeSchema(schema), [schema]);
  const initial = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.key, value[f.key] ?? f.defaultValue])),
    [fields, value],
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const parsed = schema.safeParse(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.success) onSave(parsed.data);
      }}
      className="divide-y"
    >
      {fields.map((f) => {
        const id = `sf-${f.key}`;
        const v = draft[f.key];
        return (
          <SettingsRow
            key={f.key}
            label={f.label}
            htmlFor={id}
            description={
              f.kind !== "number"
                ? undefined
                : f.min !== undefined && f.max !== undefined
                  ? `Range ${f.min}–${f.max}`
                  : f.min !== undefined
                    ? `Minimum ${f.min}`
                    : f.max !== undefined
                      ? `Maximum ${f.max}`
                      : undefined
            }
          >
            {f.kind === "boolean" ? (
              <Switch
                id={id}
                checked={Boolean(v)}
                onCheckedChange={(c) => setDraft({ ...draft, [f.key]: c })}
              />
            ) : (
              <Input
                id={id}
                className="tabular w-40 text-right"
                type={f.kind === "number" ? "number" : "text"}
                value={String(v ?? "")}
                min={f.min}
                max={f.max}
                step={f.integer ? 1 : "any"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [f.key]:
                      f.kind === "number"
                        ? e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            )}
          </SettingsRow>
        );
      })}
      <div className="flex items-center justify-end gap-3 pt-3">
        {!parsed.success && (
          <span className="text-critical-text text-xs">{parsed.error.issues[0]?.message}</span>
        )}
        <Button type="submit" size="sm" disabled={!dirty || !parsed.success}>
          Save
        </Button>
      </div>
    </form>
  );
}
