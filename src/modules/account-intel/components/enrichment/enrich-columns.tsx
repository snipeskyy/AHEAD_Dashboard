"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { STATUS_LABEL, type EnrichStatus } from "@/lib/enrich/status";
import type { AccountRow } from "../../hooks/use-accounts";
import { CompletenessMeter, EnrichStatusBadge } from "./status-badge";

export type EnrichedRow = AccountRow & {
  enrichStatus: EnrichStatus;
  completeness: number;
  pending: number;
  topMissing: string[];
};
type Col = ColumnDef<EnrichedRow>;
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export function selectColumn(
  selected: Set<string>,
  toggle: (id: string) => void,
  toggleAll: (on: boolean) => void,
  visibleIds: string[],
): Col {
  const all = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    meta: { width: 36 },
    header: () => (
      <Checkbox
        aria-label={all ? "Clear selection" : "Select all visible accounts"}
        checked={all ? true : visibleIds.some((id) => selected.has(id)) ? "indeterminate" : false}
        onCheckedChange={(v) => toggleAll(v === true)}
      />
    ),
    cell: ({ row }) => (
      <span onClick={stop} onKeyDown={stop}>
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={selected.has(row.original.id)}
          onCheckedChange={() => toggle(row.original.id)}
        />
      </span>
    ),
  };
}

export const enrichColumns = (onFetch: (id: string) => void): Col[] => [
  {
    id: "enrichment",
    header: "Public data",
    accessorFn: (r) => r.enrichStatus,
    filterFn: (row, id, v: string[]) => !v?.length || v.includes(row.getValue(id)),
    meta: { width: 150, csv: (r: EnrichedRow) => STATUS_LABEL[r.enrichStatus] },
    cell: ({ row: { original: r } }) => (
      <EnrichStatusBadge status={r.enrichStatus} pending={r.pending} />
    ),
  },
  {
    id: "completeness",
    header: "Complete",
    accessorFn: (r) => r.completeness,
    meta: { width: 110, align: "right", csv: (r: EnrichedRow) => `${r.completeness}%` },
    cell: ({ row: { original: r } }) => (
      <span
        title={r.topMissing.length ? `Most valuable gaps: ${r.topMissing.join(", ")}` : "Complete"}
      >
        <CompletenessMeter pct={r.completeness} />
      </span>
    ),
  },
  {
    id: "fetch",
    header: () => <span className="sr-only">Fetch public data</span>,
    enableSorting: false,
    enableHiding: false,
    meta: { width: 44 },
    cell: ({ row: { original: r } }) => (
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label={`Fetch public data for ${r.name}`}
        title="Fetch public data"
        disabled={r.enrichStatus === "queued" || r.enrichStatus === "running" || r.isDemo}
        onClick={(e) => {
          e.stopPropagation();
          onFetch(r.id);
        }}
      >
        <RefreshCw className={r.enrichStatus === "running" ? "animate-spin" : undefined} />
      </Button>
    ),
  },
];
