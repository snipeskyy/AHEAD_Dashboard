"use client";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_DEFS } from "@/lib/enrich/fields";
import { useSetField, type AccountEnrichment } from "../../hooks/use-enrichment";

function PromptItem({
  accountId,
  id,
  label,
  prompt,
  current,
}: {
  accountId: string;
  id: string;
  label: string;
  prompt?: string;
  current?: string;
}) {
  const set = useSetField(accountId);
  const [text, setText] = useState(current ?? "");
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        set.mutate({ field: id, value: text });
      }}
    >
      <label htmlFor={`m-${id}`} className="text-[13px] font-medium">
        {label}
      </label>
      {prompt && <p className="text-muted-foreground -mt-1 text-xs">{prompt}</p>}
      <div className="flex items-start gap-2">
        <Textarea
          id={`m-${id}`}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-[13px]"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={set.isPending || text === (current ?? "")}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

/** What public sources can't know. Saved values are user-entered (highest precedence, internal). */
export function ManualPrompts({ accountId, d }: { accountId: string; d: AccountEnrichment }) {
  const byField = new Map(d.fields.map((f) => [f.field, f]));
  const manual = FIELD_DEFS.filter((f) => f.manual);
  const publicGaps = d.missing.filter((m) => !m.manual && !m.id.startsWith("x.")).slice(0, 6);
  return (
    <section
      className="bg-card grid gap-4 rounded-lg border p-4"
      aria-labelledby="manual-h"
      data-internal-only="true"
    >
      <header>
        <h2 id="manual-h" className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardList className="size-4" aria-hidden /> Add what only you know
        </h2>
        <p className="text-muted-foreground text-xs">
          Public sources can&apos;t fill these. They stay on this machine and are marked internal.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {manual.map((f) => (
          <PromptItem
            key={`${f.id}:${byField.get(f.id)?.updatedAt ?? ""}`}
            accountId={accountId}
            id={f.id}
            label={f.label}
            prompt={f.prompt}
            current={byField.get(f.id)?.value as string | undefined}
          />
        ))}
      </div>
      {publicGaps.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Public sources didn&apos;t find: {publicGaps.map((g) => g.label).join(", ")}. Add them
          above in the profile, or resolve the identity so more sources apply.
        </p>
      )}
    </section>
  );
}
