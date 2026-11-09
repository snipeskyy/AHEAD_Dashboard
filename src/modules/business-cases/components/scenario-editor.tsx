"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_LABELS,
  COST_CATEGORIES,
  lineBase,
  lineFormula,
  SCENARIO_KINDS,
  type CostLine,
  type Scenario,
} from "@/lib/tco/model";
import { money, newId } from "./use-case";

const sel = "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]";

function Num({
  label,
  value,
  onChange,
  step = "any",
  suffix,
  w = "w-24",
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  step?: string;
  suffix?: string;
  w?: string;
}) {
  return (
    <label className="text-muted-foreground grid gap-0.5 text-[11px]">
      {label}
      <span className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          className={`h-8 ${w} text-[13px]`}
          value={value ?? ""}
          aria-label={label}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {suffix && <span className="text-[11px]">{suffix}</span>}
      </span>
    </label>
  );
}

/** One cost line: what it is, how it's costed (one-time, annual, power or staff drivers), escalation, growth. */
function LineRow({
  l,
  years,
  onChange,
  onRemove,
}: {
  l: CostLine;
  years: number;
  onChange: (l: CostLine) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<CostLine>) => onChange({ ...l, ...p });
  return (
    <li className="grid gap-2 py-2.5" aria-label={`Cost line: ${l.label}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-muted-foreground grid min-w-0 flex-1 gap-0.5 text-[11px]">
          Line
          <Input
            className="h-8 text-[13px]"
            value={l.label}
            aria-label="Line name"
            onChange={(e) => set({ label: e.target.value })}
          />
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Category
          <select
            className={sel}
            value={l.category}
            aria-label="Category"
            onChange={(e) => set({ category: e.target.value as CostLine["category"] })}
          >
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Costed as
          <select
            className={sel}
            value={l.basis}
            aria-label="Costed as"
            onChange={(e) => set({ basis: e.target.value as CostLine["basis"] })}
          >
            <option value="one-time">One-time</option>
            <option value="annual">Annual</option>
            <option value="power">Power (kW × PUE)</option>
            <option value="staff">Staff (FTE)</option>
          </select>
        </label>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${l.label}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {(l.basis === "one-time" || l.basis === "annual") && (
          <Num
            label={l.basis === "one-time" ? "Amount ($)" : "Per year ($)"}
            value={l.amount}
            onChange={(v) => set({ amount: v })}
            w="w-32"
          />
        )}
        {l.basis === "one-time" && (
          <label className="text-muted-foreground grid gap-0.5 text-[11px]">
            In year
            <select
              className={sel}
              value={l.year}
              aria-label="In year"
              onChange={(e) => set({ year: Number(e.target.value) })}
            >
              {Array.from({ length: years + 1 }, (_, y) => (
                <option key={y} value={y}>
                  {y === 0 ? "0 (upfront)" : y}
                </option>
              ))}
            </select>
          </label>
        )}
        {l.basis === "power" && (
          <>
            <Num label="IT load (kW)" value={l.itKw} onChange={(v) => set({ itKw: v })} />
            <Num
              label="Utilization"
              value={l.utilizationPct}
              onChange={(v) => set({ utilizationPct: v })}
              suffix="%"
              w="w-20"
            />
            <Num label="PUE" value={l.pue} onChange={(v) => set({ pue: v })} step="0.05" w="w-20" />
            <Num
              label="Energy price"
              value={l.pricePerKwh}
              onChange={(v) => set({ pricePerKwh: v })}
              step="0.01"
              suffix="$/kWh"
              w="w-20"
            />
          </>
        )}
        {l.basis === "staff" && (
          <>
            <Num label="FTEs" value={l.fte} onChange={(v) => set({ fte: v })} step="0.1" w="w-20" />
            <Num
              label="Loaded cost per FTE ($)"
              value={l.costPerFte}
              onChange={(v) => set({ costPerFte: v })}
              w="w-32"
            />
          </>
        )}
        {l.basis !== "one-time" && (
          <>
            <Num
              label="Price change"
              value={l.escalationPct}
              onChange={(v) => set({ escalationPct: v })}
              suffix="%/yr"
              w="w-20"
            />
            <label className="flex items-center gap-1.5 pb-2 text-[12px]">
              <Checkbox
                checked={l.scales}
                onCheckedChange={(v) => set({ scales: v === true })}
                aria-label="Grows with demand"
              />
              Grows with demand
            </label>
          </>
        )}
      </div>
      <p className="text-muted-foreground text-[11px]">
        {lineFormula(l)}
        {l.basis !== "one-time" && (
          <>
            {" "}
            · year 1:{" "}
            <span className="text-foreground tabular font-medium">{money(lineBase(l))}</span>
          </>
        )}
        {l.note && <> · {l.note}</>}
      </p>
    </li>
  );
}

/** A scenario's name, type and cost lines. */
export function ScenarioEditor({
  s,
  years,
  isBaseline,
  canRemove,
  onChange,
  onRemove,
}: {
  s: Scenario;
  years: number;
  isBaseline: boolean;
  canRemove: boolean;
  onChange: (s: Scenario) => void;
  onRemove: () => void;
}) {
  const setLine = (i: number, l: CostLine) =>
    onChange({ ...s, lines: s.lines.map((x, j) => (j === i ? l : x)) });
  return (
    <section className="grid gap-2" aria-label={`Scenario: ${s.name}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-muted-foreground grid min-w-0 flex-1 gap-0.5 text-[11px]">
          Scenario name
          <Input
            className="h-8 text-[13px]"
            value={s.name}
            aria-label="Scenario name"
            onChange={(e) => onChange({ ...s, name: e.target.value })}
          />
        </label>
        <label className="text-muted-foreground grid gap-0.5 text-[11px]">
          Type
          <select
            className={sel}
            value={s.kind}
            aria-label="Scenario type"
            onChange={(e) => onChange({ ...s, kind: e.target.value as Scenario["kind"] })}
          >
            {SCENARIO_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        {canRemove && !isBaseline && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 /> Remove scenario
          </Button>
        )}
      </div>
      <ul className="divide-y">
        {s.lines.map((l, i) => (
          <LineRow
            key={l.id}
            l={l}
            years={years}
            onChange={(nl) => setLine(i, nl)}
            onRemove={() => onChange({ ...s, lines: s.lines.filter((_, j) => j !== i) })}
          />
        ))}
        {!s.lines.length && (
          <li className="text-muted-foreground py-3 text-xs">No cost lines yet.</li>
        )}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange({
            ...s,
            lines: [
              ...s.lines,
              {
                id: newId("l"),
                label: "New cost",
                category: "other",
                basis: "annual",
                amount: 0,
                year: 0,
                escalationPct: 0,
                scales: false,
              },
            ],
          })
        }
      >
        <Plus /> Add cost line
      </Button>
    </section>
  );
}
