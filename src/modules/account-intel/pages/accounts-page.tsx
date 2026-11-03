"use client";
import { Download, Plus, Search, Upload } from "lucide-react";
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
import { accountColumns } from "../components/account-columns";
import { AddAccountDialog } from "../components/add-account-dialog";
import { useAccounts, type AccountRow } from "../hooks/use-accounts";

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
  const [source, setSource] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const industries = useMemo(
    () => [...new Set((data ?? []).map((a) => a.industry))].sort(),
    [data],
  );
  const rows = useMemo(
    () => (data ?? []).filter((a) => !source.length || source.includes(a.isDemo ? "demo" : "real")),
    [data, source],
  );
  const visible = useTableRows(rows, accountColumns, state);
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
    const metas = accountColumns.map((c) => c.meta as ColumnMetaExt<AccountRow> | undefined);
    downloadText(
      `accounts-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        accountColumns.map((c) => String(c.header)),
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
              <Link href="/accounts/import">
                <Upload /> Import CSV
              </Link>
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
          label="Source"
          options={[
            { value: "real", label: "My accounts (real)" },
            { value: "demo", label: "Demo accounts" },
          ]}
          value={source}
          onChange={setSource}
        />
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
          title="No accounts yet"
          description="Import your target accounts from a CSV, or reset demo data in Settings."
          action={
            <Button asChild size="sm">
              <Link href="/accounts/import">Import CSV</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          label="Accounts table"
          data={rows}
          columns={accountColumns}
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
