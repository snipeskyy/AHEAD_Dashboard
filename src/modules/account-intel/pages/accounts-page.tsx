"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Download, Plus, Search, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DataTable,
  EMPTY_TABLE_STATE,
  FilterChip,
  SavedViews,
  useTableRows,
  type ColumnMetaExt,
  type TableState,
} from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TIERS } from "@/lib/domain/enums";
import { downloadText, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import { STATUS_LABEL, type EnrichStatus } from "@/lib/enrich/status";
import { accountColumns } from "../components/account-columns";
import {
  enrichColumns,
  selectColumn,
  type EnrichedRow,
} from "../components/enrichment/enrich-columns";
import { QueueSheet } from "../components/enrichment/queue-sheet";
import { useEnqueue, useEnrichmentOverview } from "../hooks/use-enrichment";
import { AddAccountDialog } from "../components/add-account-dialog";
import { useAccounts } from "../hooks/use-accounts";

const DEFAULT_STATE: TableState = {
  ...EMPTY_TABLE_STATE,
  sorting: [
    { id: "tier", desc: false },
    { id: "health", desc: false },
  ],
  columnVisibility: { industry: false, domain: false, revenue: false },
};
const BUILT_IN = [
  { name: "All accounts", config: DEFAULT_STATE },
  {
    name: "Strategic — lowest health first",
    config: {
      ...DEFAULT_STATE,
      columnFilters: [{ id: "tier", value: ["Strategic"] }],
      sorting: [{ id: "health", desc: false }],
    },
  },
  {
    name: "Biggest whitespace",
    config: { ...DEFAULT_STATE, sorting: [{ id: "whitespace", desc: true }] },
  },
  {
    name: "Most active this week",
    config: { ...DEFAULT_STATE, sorting: [{ id: "signals7d", desc: true }] },
  },
];

export default function AccountsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAccounts();
  const [state, setState] = useState<TableState>(DEFAULT_STATE);
  const [adding, setAdding] = useState(false);
  const industries = useMemo(
    () => [...new Set((data ?? []).map((a) => a.industry))].sort(),
    [data],
  );
  const overview = useEnrichmentOverview();
  const enqueue = useEnqueue();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = useMemo<EnrichedRow[]>(() => {
    const ov = new Map((overview.data ?? []).map((o) => [o.accountId, o]));
    return (data ?? []).map((a) => {
      const o = ov.get(a.id);
      return {
        ...a,
        enrichStatus: o?.status ?? "not-enriched",
        completeness: o?.completeness ?? 0,
        pending: o?.pending ?? 0,
        topMissing: o?.topMissing ?? [],
      };
    });
  }, [data, overview.data]);
  const baseCols = accountColumns as unknown as ColumnDef<EnrichedRow>[];
  const enqueueMutate = enqueue.mutate;
  const extra = useMemo(
    () => enrichColumns((id) => enqueueMutate({ accountIds: [id] })),
    [enqueueMutate],
  );
  const dataCols = useMemo(
    () => [baseCols[0], extra[0], extra[1], ...baseCols.slice(1), extra[2]],
    [baseCols, extra],
  );
  const visible = useTableRows(rows, dataCols, state);
  const visibleIds = useMemo(() => visible.map((r) => r.id), [visible]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(visibleIds) : new Set());
  const columns = [selectColumn(selected, toggle, toggleAll, visibleIds), ...dataCols];
  const filterVal = (id: string) =>
    (state.columnFilters.find((f) => f.id === id)?.value as string[] | undefined) ?? [];
  const setFilter = (id: string, value: string[]) =>
    setState({
      ...state,
      columnFilters: [
        ...state.columnFilters.filter((f) => f.id !== id),
        ...(value.length ? [{ id, value }] : []),
      ],
    });

  const exportCsv = () => {
    const metas = dataCols.map((c) => c.meta as ColumnMetaExt<EnrichedRow> | undefined);
    downloadText(
      `accounts-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        dataCols.filter((c) => typeof c.header === "string").map((c) => String(c.header)),
        visible.map((r) => metas.map((m) => m?.csv?.(r) ?? "")),
      ),
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Every account at a glance. Health and whitespace scores are explainable — open an account to see the inputs."
        actions={
          <>
            <SavedViews<TableState>
              scope="accounts"
              current={state}
              builtIn={BUILT_IN}
              onApply={(c) => setState(c)}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={exportCsv}
              disabled={!visible.length}
            >
              <Download /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8" asChild>
              <Link href="/import?kind=accounts">
                <Upload /> Import
              </Link>
            </Button>
            <QueueSheet />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!rows.length || enqueue.isPending}
              onClick={() => enqueue.mutate({ all: true, force: false })}
              title="Fetch public data for every account (skips sources that are still fresh)"
            >
              <Sparkles /> Enrich all
            </Button>
            <Button size="sm" className="h-8" onClick={() => setAdding(true)}>
              <Plus /> Add account
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={state.globalFilter}
            onChange={(e) => setState({ ...state, globalFilter: e.target.value })}
            placeholder="Filter accounts…"
            className="h-8 w-56 pl-8"
            aria-label="Filter accounts"
          />
        </div>
        <FilterChip
          label="Tier"
          options={TIERS.map((t) => ({ value: t, label: t }))}
          value={filterVal("tier")}
          onChange={(v) => setFilter("tier", v)}
        />
        <FilterChip
          label="Industry"
          options={industries.map((i) => ({ value: i, label: i }))}
          value={filterVal("industry")}
          onChange={(v) => setFilter("industry", v)}
        />
        <FilterChip
          label="Public data"
          options={(Object.keys(STATUS_LABEL) as EnrichStatus[]).map((v) => ({
            value: v,
            label: v === "stale" ? "Stale data" : STATUS_LABEL[v],
          }))}
          value={filterVal("enrichment")}
          onChange={(v) => setFilter("enrichment", v)}
        />
        {selected.size > 0 && (
          <div
            className="bg-brand-soft flex items-center gap-2 rounded-md px-2 py-1 text-xs"
            role="region"
            aria-label="Selection actions"
          >
            <span className="font-medium">{selected.size} selected</span>
            <Button
              size="sm"
              className="h-7"
              disabled={enqueue.isPending}
              onClick={() =>
                enqueue.mutate(
                  { accountIds: [...selected] },
                  { onSuccess: () => setSelected(new Set()) },
                )
              }
            >
              <Sparkles /> Enrich selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}
        <span className="text-muted-foreground ml-auto text-xs" aria-live="polite">
          {formatNumber(visible.length)} of {formatNumber(data?.length ?? 0)} accounts
        </span>
      </div>
      {isLoading ? (
        <Skeleton className="h-[480px] w-full rounded-lg" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState
          icon={Building2}
          title="No accounts yet"
          description="Import the accounts you cover from CSV, Excel or a pasted list, or add one by hand."
          action={
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/import?kind=accounts">
                  <Upload /> Import accounts
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                Add account
              </Button>
            </div>
          }
        />
      ) : (
        <DataTable
          label="Accounts table"
          data={rows}
          columns={columns}
          state={state}
          onStateChange={setState}
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/accounts/${r.id}`)}
          rowHeight={48}
        />
      )}
      <AddAccountDialog open={adding} onOpenChange={setAdding} />
    </PageContainer>
  );
}
