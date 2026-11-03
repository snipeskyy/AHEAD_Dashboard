"use client";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface TableState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
  columnVisibility: VisibilityState;
}

export const EMPTY_TABLE_STATE: TableState = {
  sorting: [],
  columnFilters: [],
  globalFilter: "",
  columnVisibility: {},
};

/** Column meta used by the table + CSV export. */
export interface ColumnMetaExt<T> {
  align?: "left" | "right" | "center";
  /** Plain value for CSV export (defaults to accessor value). */
  csv?: (row: T) => unknown;
  /** Mark columns that must disappear in Presentation Mode. */
  internalOnly?: boolean;
  width?: number;
}

export const includesSome: FilterFn<unknown> = (row, columnId, value: string[]) => {
  if (!value?.length) return true;
  const v = row.getValue(columnId);
  return Array.isArray(v) ? v.some((x) => value.includes(String(x))) : value.includes(String(v));
};

export interface DataTableProps<T> {
  data: T[];
  columns: Array<ColumnDef<T, unknown>>;
  state: TableState;
  onStateChange: (s: TableState) => void;
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  height?: number | string;
  rowHeight?: number;
  /** Receives the filtered + sorted rows (for counts and CSV export). */
  onRowsChange?: (rows: T[]) => void;
  label: string;
  emptyMessage?: string;
}

/** Virtualized, sortable, filterable table. Handles thousands of rows smoothly. */
export function DataTable<T>({
  data,
  columns,
  state,
  onStateChange,
  getRowId,
  onRowClick,
  height = "calc(100svh - 260px)",
  rowHeight = 40,
  label,
  emptyMessage = "No rows match the current filters.",
}: DataTableProps<T>) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions; used as documented
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state,
    filterFns: { includesSome },
    onSortingChange: (u) =>
      onStateChange({ ...state, sorting: typeof u === "function" ? u(state.sorting) : u }),
    onColumnFiltersChange: (u) =>
      onStateChange({
        ...state,
        columnFilters: typeof u === "function" ? u(state.columnFilters) : u,
      }),
    onGlobalFilterChange: (u) =>
      onStateChange({
        ...state,
        globalFilter: typeof u === "function" ? u(state.globalFilter) : u,
      }),
    onColumnVisibilityChange: (u) =>
      onStateChange({
        ...state,
        columnVisibility: typeof u === "function" ? u(state.columnVisibility) : u,
      }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const visibleCols = table.getVisibleLeafColumns().length;

  return (
    <div
      ref={parentRef}
      className="bg-card relative overflow-auto rounded-lg border"
      style={{ height }}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table
        className="w-full border-separate border-spacing-0 text-[13px]"
        aria-rowcount={rows.length}
      >
        <thead className="bg-card sticky top-0 z-10">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta as ColumnMetaExt<T> | undefined;
                const sorted = h.column.getIsSorted();
                return (
                  <th
                    key={h.id}
                    scope="col"
                    data-internal-only={meta?.internalOnly ? "true" : undefined}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                    style={{ width: meta?.width }}
                    className={cn(
                      "text-muted-foreground border-b px-3 py-2 text-xs font-medium whitespace-nowrap",
                      meta?.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "hover:text-foreground inline-flex items-center gap-1 rounded",
                          meta?.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden>
              <td style={{ height: padTop }} colSpan={visibleCols} />
            </tr>
          )}
          {items.map((vi) => {
            const row = rows[vi.index];
            return (
              <tr
                key={row.id}
                data-index={vi.index}
                aria-rowindex={vi.index + 1}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick ? (e) => e.key === "Enter" && onRowClick(row.original) : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "group",
                  onRowClick && "hover:bg-muted/50 focus-visible:bg-muted/50 cursor-pointer",
                )}
                style={{ height: rowHeight }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMetaExt<T> | undefined;
                  return (
                    <td
                      key={cell.id}
                      data-internal-only={meta?.internalOnly ? "true" : undefined}
                      className={cn(
                        "border-b px-3 whitespace-nowrap",
                        meta?.align === "right" && "tabular text-right",
                        meta?.align === "center" && "text-center",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden>
              <td style={{ height: padBottom }} colSpan={visibleCols} />
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={visibleCols}
                className="text-muted-foreground px-3 py-12 text-center text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Applies the same filtering/sorting as the table, for counts and CSV export, without rendering. */
export function useTableRows<T>(
  data: T[],
  columns: Array<ColumnDef<T, unknown>>,
  state: TableState,
) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table instance is intentionally recreated
  const table = useReactTable({
    data,
    columns,
    state,
    filterFns: { includesSome },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return table.getRowModel().rows.map((r) => r.original);
}
