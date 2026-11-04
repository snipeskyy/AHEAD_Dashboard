"use client";
import {
  BarChart3,
  Briefcase,
  Download,
  KanbanSquare,
  LineChart,
  Plus,
  Table2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  EMPTY_TABLE_STATE,
  SavedViews,
  useTableRows,
  type ColumnMetaExt,
  type TableState,
} from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { StatTile } from "@/components/kpi/stat-tile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadText, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import type { OppRow } from "@/lib/pipeline/types";
import { AnalyticsView } from "../components/analytics-view";
import { CreateOppDialog } from "../components/create-opp-dialog";
import { ForecastView } from "../components/forecast-view";
import { KanbanBoard } from "../components/kanban-board";
import { PipelineKpiStrip } from "../components/kpi-strip";
import { OppDetailSheet } from "../components/opp-detail-sheet";
import {
  applyOppFilters,
  EMPTY_OPP_FILTERS,
  OppFilterBar,
  type OppFilters,
} from "../components/opp-filters";
import { OppTable, useOppColumns } from "../components/opp-table";
import { useOpportunities } from "../hooks/use-opportunities";
import { usePipelineAnalytics, useStageEvents } from "../hooks/use-pipeline-data";

type View = "board" | "table" | "forecast" | "analytics";
const VIEWS: Array<{ id: View; label: string; icon: typeof Table2 }> = [
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "table", label: "Table", icon: Table2 },
  { id: "forecast", label: "Forecast", icon: LineChart },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const DEFAULT_TABLE_STATE: TableState = {
  ...EMPTY_TABLE_STATE,
  sorting: [{ id: "closeDate", desc: false }],
  columnVisibility: { account: false },
};

interface ViewConfig {
  view: View;
  filters: OppFilters;
  table: TableState;
}

const BUILT_IN: Array<{ name: string; config: ViewConfig }> = [
  {
    name: "All open pipeline",
    config: { view: "board", filters: EMPTY_OPP_FILTERS, table: DEFAULT_TABLE_STATE },
  },
  {
    name: "At-risk deals",
    config: {
      view: "table",
      filters: { ...EMPTY_OPP_FILTERS, riskOnly: true },
      table: { ...DEFAULT_TABLE_STATE, sorting: [{ id: "amount", desc: true }] },
    },
  },
  {
    name: "Commit this quarter",
    config: {
      view: "table",
      filters: { ...EMPTY_OPP_FILTERS, forecast: ["Commit"] },
      table: { ...DEFAULT_TABLE_STATE, sorting: [{ id: "closeDate", desc: false }] },
    },
  },
  {
    name: "Strategic accounts",
    config: {
      view: "board",
      filters: { ...EMPTY_OPP_FILTERS, tier: ["Strategic"] },
      table: DEFAULT_TABLE_STATE,
    },
  },
];

export default function OpportunitiesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "board") as View;
  const focus = params.get("focus");
  const creating = params.get("create") === "1";

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const [filters, setFilters] = useState<OppFilters>(EMPTY_OPP_FILTERS);
  const [tableState, setTableState] = useState<TableState>(DEFAULT_TABLE_STATE);
  const { data, isLoading, error, refetch } = useOpportunities();
  const { data: events } = useStageEvents();
  const filtered = useMemo(() => applyOppFilters(data ?? [], filters), [data, filters]);
  const analytics = usePipelineAnalytics(filtered, events);
  const columns = useOppColumns();
  const tableRows = useTableRows(filtered, columns, tableState);

  const exportCsv = () => {
    const cols = columns;
    const metas = cols.map((c) => c.meta as ColumnMetaExt<OppRow> | undefined);
    const rows = (view === "table" ? tableRows : filtered).map((r) =>
      cols.map((c, i) => (metas[i]?.csv ? metas[i]!.csv!(r) : "")),
    );
    downloadText(
      `opportunities-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        cols.map((c) => String(c.header)),
        rows,
      ),
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Opportunities"
        description="Plan and track pipeline. Drag cards between stages; every move is recorded in stage history."
        actions={
          <>
            <SavedViews<ViewConfig>
              scope="opportunities"
              current={{ view, filters, table: tableState }}
              builtIn={BUILT_IN}
              onApply={(c) => {
                setFilters(c.filters);
                setTableState(c.table);
                setParam({ view: c.view });
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={exportCsv}
              disabled={!filtered.length}
            >
              <Download /> CSV
            </Button>
            <Button size="sm" className="h-8" onClick={() => setParam({ create: "1" })}>
              <Plus /> New opportunity
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState
          icon={Briefcase}
          title="No opportunities yet"
          description="Add one here or from an account, or import them from CSV or Excel. Forecast and analytics appear once you have deals."
          action={
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <Link href="/import?kind=opportunities">
                  <Upload /> Import opportunities
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setParam({ create: "1" })}>
                <Plus /> New opportunity
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <PipelineKpiStrip k={analytics.kpis} />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <OppFilterBar value={filters} onChange={setFilters} />
            <Tabs value={view} onValueChange={(v) => setParam({ view: v })}>
              <TabsList>
                {VIEWS.map((v) => (
                  <TabsTrigger
                    aria-controls={
                      undefined /* URL-driven tabs: the panel is rendered outside <Tabs> */
                    }
                    key={v.id}
                    value={v.id}
                    className="gap-1.5"
                  >
                    <v.icon className="size-3.5" /> {v.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <p className="text-muted-foreground -mt-3 text-xs" aria-live="polite">
            {formatNumber(filtered.length)} of {formatNumber(data?.length ?? 0)} opportunities
          </p>
          {view === "board" && (
            <KanbanBoard rows={filtered} onOpen={(id) => setParam({ focus: id })} />
          )}
          {view === "table" && (
            <OppTable
              rows={filtered}
              state={tableState}
              onStateChange={setTableState}
              onOpen={(id) => setParam({ focus: id })}
            />
          )}
          {view === "forecast" && <ForecastView a={analytics} />}
          {view === "analytics" && <AnalyticsView a={analytics} />}
          {filtered.length === 0 && view !== "table" && (
            <StatTile
              label="No matches"
              value="0 opportunities"
              sub="Clear filters to see all deals"
            />
          )}
        </>
      )}

      <OppDetailSheet id={focus} onClose={() => setParam({ focus: null })} />
      <CreateOppDialog
        open={creating}
        onOpenChange={(o) => !o && setParam({ create: null })}
        onCreated={(id) => setParam({ create: null, focus: id })}
      />
    </PageContainer>
  );
}
