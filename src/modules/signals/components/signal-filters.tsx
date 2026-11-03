"use client";
import { Search, X } from "lucide-react";
import { AccountPicker } from "@/components/account-picker";
import { FilterChip } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { SOURCE_CATALOG } from "@/lib/adapters/catalog";
import { SIGNAL_TYPES, SIGNAL_TYPE_LABELS, TIERS } from "@/lib/domain/enums";
import { DEFAULT_SIGNAL_FILTERS, type SignalFilters } from "../hooks/use-signals";

const DATE_OPTS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "Any time" },
];
const REL_OPTS = [
  { value: "0", label: "Any" },
  { value: "40", label: "≥ 40" },
  { value: "60", label: "≥ 60" },
  { value: "75", label: "≥ 75" },
];

/** The single filter row above the feed (spec: account, type, practice tag, source, date, relevance). */
export function SignalFilterBar({
  value: f,
  onChange,
}: {
  value: SignalFilters;
  onChange: (f: SignalFilters) => void;
}) {
  const set = (patch: Partial<SignalFilters>) => onChange({ ...f, ...patch });
  const dirty = JSON.stringify(f) !== JSON.stringify(DEFAULT_SIGNAL_FILTERS);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search headlines…"
            className="h-8 w-56 pl-8"
            aria-label="Search signals"
          />
        </div>
        <div className="w-56">
          <AccountPicker
            value={f.accountId ? { id: f.accountId, name: f.accountName ?? "Account" } : null}
            onChange={(a) => set({ accountId: a?.id ?? null, accountName: a?.name ?? null })}
          />
        </div>
        <FilterChip
          label="Type"
          options={SIGNAL_TYPES.map((t) => ({ value: t, label: SIGNAL_TYPE_LABELS[t] }))}
          value={f.types}
          onChange={(types) => set({ types })}
        />
        <FilterChip
          label="Practice"
          options={DEFAULT_PRACTICE_AREAS.map((p) => ({ value: p.id, label: p.label }))}
          value={f.practices}
          onChange={(practices) => set({ practices })}
        />
        <FilterChip
          label="Source"
          options={SOURCE_CATALOG.filter((s) => s.kind !== "private-future").map((s) => ({
            value: s.id,
            label: s.label,
          }))}
          value={f.sources}
          onChange={(sources) => set({ sources })}
        />
        <FilterChip
          label="Tier"
          options={TIERS.map((t) => ({ value: t, label: t }))}
          value={f.tiers}
          onChange={(tiers) => set({ tiers })}
        />
        <FilterChip
          label="Date"
          options={DATE_OPTS}
          value={[f.sinceDays === null ? "all" : String(f.sinceDays)]}
          onChange={(v) => {
            const last = v.at(-1) ?? "30";
            set({ sinceDays: last === "all" ? null : Number(last) });
          }}
        />
        <FilterChip
          label="Relevance"
          options={REL_OPTS}
          value={[String(f.minRelevance)]}
          onChange={(v) => set({ minRelevance: Number(v.at(-1) ?? 0) })}
        />
        <FilterChip
          label="Sort"
          options={[
            { value: "recent", label: "Most recent" },
            { value: "relevance", label: "Most relevant" },
          ]}
          value={[f.sort]}
          onChange={(v) => set({ sort: (v.at(-1) as SignalFilters["sort"]) ?? "recent" })}
        />
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_SIGNAL_FILTERS)}>
            <X /> Reset
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {(
          [
            ["unread", "Unread only"],
            ["starred", "Starred"],
            ["inNextSummary", "In next summary"],
            ["includeDismissed", "Show dismissed"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="flex items-center gap-2">
            <Switch id={`sf-${k}`} checked={f[k]} onCheckedChange={(v) => set({ [k]: v })} />
            <Label htmlFor={`sf-${k}`} className="text-[13px] font-normal">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
