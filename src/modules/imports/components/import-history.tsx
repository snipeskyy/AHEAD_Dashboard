"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Undo2 } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { KIND_DEFS } from "@/lib/import/kinds";
import type { ImportKind } from "@/lib/import/types";
import { UndoImportDialog } from "./undo-dialog";

interface Batch {
  id: string;
  kind: ImportKind;
  fileName: string | null;
  inputType: string;
  status: "applied" | "undone";
  counts: { created: number; merged: number; skipped: number; errors: number };
  createdAt: string;
  undoneAt: string | null;
  groupId: string | null;
}

/** Every import, logged and undoable. */
export function ImportHistory() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["import-batches"],
    queryFn: () => api<{ items: Batch[] }>("/api/import/batches").then((r) => r.items),
  });
  if (isLoading) return <CardSkeleton lines={6} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data?.length)
    return (
      <EmptyState
        icon={History}
        title="No imports yet"
        description="Every import you run is listed here and can be undone."
      />
    );
  return (
    <div
      className="bg-card overflow-x-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label="Import history"
    >
      <table className="w-full text-left text-[13px]">
        <thead className="text-muted-foreground border-b text-xs">
          <tr>
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2 font-medium">Merged</th>
            <th className="px-4 py-2 font-medium">Skipped / errors</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-2 whitespace-nowrap">
                {format(new Date(b.createdAt), "MMM d, yyyy h:mm a")}
              </td>
              <td className="px-4 py-2">
                {(b.kind as string) === "pack"
                  ? "Shareable pack"
                  : (b.kind as string) === "contract"
                    ? "Activities & tasks"
                    : (KIND_DEFS[b.kind as keyof typeof KIND_DEFS]?.label ?? b.kind)}
              </td>
              <td className="max-w-56 truncate px-4 py-2">
                {b.inputType === "contract"
                  ? `Data contract${b.fileName ? ` · ${b.fileName}` : ""}`
                  : (b.fileName ?? (b.inputType === "paste" ? "Pasted list" : b.inputType))}
              </td>
              <td className="px-4 py-2 tabular-nums">{b.counts.created}</td>
              <td className="px-4 py-2 tabular-nums">{b.counts.merged}</td>
              <td className="px-4 py-2 tabular-nums">
                {b.counts.skipped} / {b.counts.errors}
              </td>
              <td className="px-4 py-2">
                {b.status === "undone" ? (
                  <Badge variant="outline" className="text-muted-foreground font-normal">
                    Undone {b.undoneAt ? format(new Date(b.undoneAt), "MMM d") : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-good-text font-normal">
                    Applied
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2 text-right">
                {b.status === "applied" && (
                  <UndoImportDialog
                    batchId={b.id}
                    onDone={() => qc.invalidateQueries()}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        aria-label={`Undo import from ${format(new Date(b.createdAt), "MMM d")}`}
                      >
                        <Undo2 /> Undo
                      </Button>
                    }
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
