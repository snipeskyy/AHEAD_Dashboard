"use client";
import { Search } from "lucide-react";
import { FilterChip } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { FORECAST_CATEGORIES, TIERS } from "@/lib/domain/enums";
import type { OppRow } from "@/lib/pipeline/types";

export interface OppFilters {
  q: string;
  practice: string[];
  tier: string[];
  forecast: string[];
  riskOnly: boolean;
}
export const EMPTY_OPP_FILTERS: OppFilters = {
  q: "",
  practice: [],
  tier: [],
  forecast: [],
  riskOnly: false,
};

export function applyOppFilters(rows: OppRow[], f: OppFilters): OppRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.accountName.toLowerCase().includes(q)) &&
      (!f.practice.length || f.practice.includes(r.practiceArea)) &&
      (!f.tier.length || f.tier.includes(r.accountTier)) &&
      (!f.forecast.length || f.forecast.includes(r.forecastCategory)) &&
      (!f.riskOnly || r.riskFlags.length > 0),
  );
}

const FORECAST_LABELS: Record<string, string> = {
  Pipeline: "Pipeline",
  BestCase: "Best case",
  Commit: "Commit",
  Closed: "Closed",
  Omitted: "Omitted",
};
export const forecastLabel = (c: string) => FORECAST_LABELS[c] ?? c;

/** One filter row above every opportunity view (board, table, forecast, analytics). */
export function OppFilterBar({
  value,
  onChange,
}: {
  value: OppFilters;
  onChange: (f: OppFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Filter by opp or account…"
          className="h-8 w-56 pl-8"
          aria-label="Filter opportunities"
        />
      </div>
      <FilterChip
        label="Practice"
        options={DEFAULT_PRACTICE_AREAS.map((p) => ({ value: p.id, label: p.label }))}
        value={value.practice}
        onChange={(practice) => onChange({ ...value, practice })}
      />
      <FilterChip
        label="Tier"
        options={TIERS.map((t) => ({ value: t, label: t }))}
        value={value.tier}
        onChange={(tier) => onChange({ ...value, tier })}
      />
      <FilterChip
        label="Forecast"
        options={FORECAST_CATEGORIES.map((c) => ({ value: c, label: forecastLabel(c) }))}
        value={value.forecast}
        onChange={(forecast) => onChange({ ...value, forecast })}
      />
      <div className="flex items-center gap-2 pl-1" data-internal-only="true">
        <Switch
          id="risk-only"
          checked={value.riskOnly}
          onCheckedChange={(riskOnly) => onChange({ ...value, riskOnly })}
        />
        <Label htmlFor="risk-only" className="text-[13px] font-normal">
          At-risk only
        </Label>
      </div>
    </div>
  );
}
