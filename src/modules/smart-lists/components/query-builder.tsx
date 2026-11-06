"use client";
import { Plus, X } from "lucide-react";
import { FilterChip } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { practiceLabel } from "@/config/practice-areas";
import { SMART_FIELDS } from "@/lib/daily/smart-fields";
import { OPS, type Rules, type SmartEntity } from "@/lib/daily/smart-lists";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm";
const optLabel = (v: string) => (/^(ai-infra|modern-dc|cloud|data-analytics|security|automation|esm|managed-services|integration-facility)$/.test(v) ? practiceLabel(v) : v);

/** Rule editor: field → operator (by field type) → value. "All" or "any" rules must match. */
export function QueryBuilder({ entity, value, onChange }: { entity: SmartEntity; value: Rules; onChange: (r: Rules) => void }) {
  const fields = SMART_FIELDS[entity];
  const set = (i: number, patch: Partial<Rules["rules"][number]>) => onChange({ ...value, rules: value.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-[13px]">
        Match
        <select aria-label="Match all or any rule" className={sel} value={value.match} onChange={(e) => onChange({ ...value, match: e.target.value as Rules["match"] })}>
          <option value="all">all rules</option>
          <option value="any">any rule</option>
        </select>
      </div>
      {value.rules.map((r, i) => {
        const f = fields.find((x) => x.id === r.field) ?? fields[0];
        const ops = OPS[f.type];
        const needsValue = !["empty", "notEmpty", "isTrue", "isFalse"].includes(r.op);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Rule ${i + 1}`}>
            <select aria-label="Field" className={sel} value={f.id} onChange={(e) => { const nf = fields.find((x) => x.id === e.target.value)!; set(i, { field: nf.id, op: OPS[nf.type][0].id, value: undefined }); }}>
              {fields.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <select aria-label="Operator" className={sel} value={r.op} onChange={(e) => set(i, { op: e.target.value })}>
              {ops.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {needsValue && (f.type === "enum" || f.type === "list") ? (
              <FilterChip label="Values" options={(f.options ?? []).map((o) => ({ value: o, label: optLabel(o) }))} value={(r.value as string[] | undefined) ?? []} onChange={(v) => set(i, { value: v })} />
            ) : needsValue ? (
              <Input aria-label="Value" className="h-8 w-40" type={f.type === "number" || f.type === "date" ? "number" : "text"} placeholder={f.type === "date" ? "days" : ""} value={(r.value as string | number | undefined) ?? ""} onChange={(e) => set(i, { value: f.type === "text" ? e.target.value : e.target.value === "" ? undefined : Number(e.target.value) })} />
            ) : null}
            <Button variant="ghost" size="icon-xs" aria-label={`Remove rule ${i + 1}`} onClick={() => onChange({ ...value, rules: value.rules.filter((_, j) => j !== i) })}><X /></Button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange({ ...value, rules: [...value.rules, { field: fields[0].id, op: OPS[fields[0].type][0].id }] })}><Plus /> Add rule</Button>
    </div>
  );
}
