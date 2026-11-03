"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DataTable,
  InlineDate,
  InlineNumber,
  InlineSelect,
  InlineText,
  type ColumnMetaExt,
  type TableState,
} from "@/components/data-table";
import { DEFAULT_PRACTICE_AREAS, practiceLabel } from "@/config/practice-areas";
import { FORECAST_CATEGORIES, STAGES, STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { OppRow } from "@/lib/pipeline/types";
import { DEAL_RISK_LABELS } from "@/lib/scoring/deal-risk";
import { useUpdateOpportunity } from "../hooks/use-opportunities";
import { MeddpiccMeter, RiskBadge } from "./badges";
import { forecastLabel } from "./opp-filters";

type Col = ColumnDef<OppRow, unknown> & { meta?: ColumnMetaExt<OppRow> };

export function useOppColumns(): Col[] {
  const { mutate } = useUpdateOpportunity();
  return useMemo<Col[]>(() => {
    const patch = (id: string, p: Parameters<typeof mutate>[0]["patch"]) =>
      mutate({ id, patch: p });
    return [
      {
        id: "name",
        header: "Opportunity",
        accessorFn: (r) => r.name,
        meta: { width: 280, csv: (r) => r.name },
        cell: ({ row: { original: r } }) => (
          <div className="max-w-72 min-w-0">
            <div className="truncate font-medium">{r.name}</div>
            <div className="text-muted-foreground truncate text-xs">{r.accountName}</div>
          </div>
        ),
      },
      {
        id: "account",
        header: "Account",
        accessorFn: (r) => r.accountName,
        enableHiding: true,
        meta: { csv: (r) => r.accountName },
      },
      {
        id: "practice",
        header: "Practice",
        accessorFn: (r) => r.practiceArea,
        meta: { csv: (r) => practiceLabel(r.practiceArea) },
        cell: ({ row: { original: r } }) => (
          <InlineSelect
            label={`Practice for ${r.name}`}
            value={r.practiceArea}
            options={DEFAULT_PRACTICE_AREAS.map((p) => ({ value: p.id, label: p.short }))}
            onCommit={(v) => patch(r.id, { practiceArea: v })}
          />
        ),
      },
      {
        id: "stage",
        header: "Stage",
        accessorFn: (r) => STAGES.indexOf(r.stage),
        meta: { csv: (r) => STAGE_LABELS[r.stage], internalOnly: true },
        cell: ({ row: { original: r } }) => (
          <InlineSelect
            label={`Stage for ${r.name}`}
            value={r.stage}
            options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
            onCommit={(v) => patch(r.id, { stage: v as Stage })}
          />
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorFn: (r) => r.amount,
        meta: { align: "right", csv: (r) => r.amount, internalOnly: true, width: 120 },
        cell: ({ row: { original: r } }) => (
          <InlineNumber
            label={`Amount for ${r.name}`}
            value={r.amount}
            format={formatCurrency}
            onCommit={(v) => patch(r.id, { amount: v })}
          />
        ),
      },
      {
        id: "weighted",
        header: "Weighted",
        accessorFn: (r) => r.weighted,
        meta: { align: "right", csv: (r) => r.weighted, internalOnly: true },
        cell: ({ getValue }) => formatCurrencyCompact(getValue() as number),
      },
      {
        id: "probability",
        header: "Prob.",
        accessorFn: (r) => r.probability,
        meta: { align: "right", csv: (r) => r.probability, internalOnly: true, width: 70 },
        cell: ({ row: { original: r } }) => (
          <InlineNumber
            label={`Probability for ${r.name}`}
            value={r.probability}
            max={100}
            format={(v) => `${v}%`}
            onCommit={(v) => patch(r.id, { probability: Math.round(v) })}
          />
        ),
      },
      {
        id: "closeDate",
        header: "Close date",
        accessorFn: (r) => r.closeDate,
        meta: { csv: (r) => r.closeDate.slice(0, 10) },
        cell: ({ row: { original: r } }) => (
          <InlineDate
            label={`Close date for ${r.name}`}
            value={r.closeDate}
            onCommit={(iso) => patch(r.id, { closeDate: iso })}
          />
        ),
      },
      {
        id: "forecast",
        header: "Forecast",
        accessorFn: (r) => r.forecastCategory,
        meta: { csv: (r) => forecastLabel(r.forecastCategory), internalOnly: true },
        cell: ({ row: { original: r } }) => (
          <InlineSelect
            label={`Forecast category for ${r.name}`}
            value={r.forecastCategory}
            options={FORECAST_CATEGORIES.map((c) => ({ value: c, label: forecastLabel(c) }))}
            onCommit={(v) => patch(r.id, { forecastCategory: v })}
          />
        ),
      },
      {
        id: "meddpicc",
        header: "MEDDPICC",
        accessorFn: (r) => r.meddpiccScore,
        meta: { csv: (r) => r.meddpiccScore, internalOnly: true },
        cell: ({ getValue }) => <MeddpiccMeter score={getValue() as number} />,
      },
      {
        id: "risk",
        header: "Risk",
        accessorFn: (r) => r.riskFlags.length,
        meta: {
          csv: (r) => r.riskFlags.map((f) => DEAL_RISK_LABELS[f]).join("; "),
          internalOnly: true,
        },
        cell: ({ row: { original: r } }) => <RiskBadge flags={r.riskFlags} />,
      },
      {
        id: "daysInStage",
        header: "Days in stage",
        accessorFn: (r) => r.daysInStage,
        meta: { align: "right", csv: (r) => r.daysInStage },
      },
      {
        id: "nextStep",
        header: "Next step",
        accessorFn: (r) => r.nextStep ?? "",
        meta: { csv: (r) => r.nextStep ?? "", width: 240 },
        cell: ({ row: { original: r } }) => (
          <InlineText
            label={`Next step for ${r.name}`}
            value={r.nextStep ?? ""}
            placeholder="Add next step…"
            className="min-w-52"
            onCommit={(v) => patch(r.id, { nextStep: v || null })}
          />
        ),
      },
    ];
  }, [mutate]);
}

export function OppTable({
  rows,
  state,
  onStateChange,
  onOpen,
}: {
  rows: OppRow[];
  state: TableState;
  onStateChange: (s: TableState) => void;
  onOpen: (id: string) => void;
}) {
  const columns = useOppColumns();
  const [showClosed, setShowClosed] = useState(false);
  const visible = useMemo(
    () =>
      showClosed ? rows : rows.filter((r) => r.stage !== "ClosedWon" && r.stage !== "ClosedLost"),
    [rows, showClosed],
  );
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Switch id="show-closed" checked={showClosed} onCheckedChange={setShowClosed} />
        <Label htmlFor="show-closed" className="text-[13px] font-normal">
          Show closed deals
        </Label>
      </div>
      <DataTable
        label="Opportunities table"
        data={visible}
        columns={columns}
        state={state}
        onStateChange={onStateChange}
        getRowId={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
      />
    </div>
  );
}
