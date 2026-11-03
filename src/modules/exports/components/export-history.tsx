"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Download, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { FORMAT_META, type ExportFormat } from "@/lib/export/config";

interface Job {
  id: string;
  title: string;
  format: ExportFormat;
  status: string;
  version: number;
  audience: string;
  createdAt: string;
}

export function ExportHistory() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["exports"],
    queryFn: () => api<{ items: Job[] }>("/api/exports").then((r) => r.items),
  });
  const rerun = useMutation({
    mutationFn: (id: string) => api<{ job: Job }>(`/api/exports/${id}/rerun`, { method: "POST" }),
    onSuccess: (r) => {
      toast.success(`Re-ran as v${r.job.version}`);
      qc.invalidateQueries({ queryKey: ["exports"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/exports/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exports"] }),
  });
  if (!data?.length)
    return (
      <EmptyState
        title="No exports yet"
        description="Generated summaries appear here with download and re-run."
      />
    );
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]">
        <caption className="sr-only">Export history</caption>
        <thead className="text-muted-foreground text-xs">
          <tr className="border-b">
            {["Title", "Version", "Format", "Audience", "Created", "Status", ""].map((h, i) => (
              <th key={i} scope="col" className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((j) => (
            <tr key={j.id} className="border-b last:border-0">
              <td className="px-4 py-2 font-medium">{j.title}</td>
              <td className="tabular px-4 py-2">v{j.version}</td>
              <td className="px-4 py-2">{FORMAT_META[j.format]?.label ?? j.format}</td>
              <td className="px-4 py-2">
                <Badge
                  variant="outline"
                  className={
                    j.audience === "customer"
                      ? "border-good/40 text-good-text font-normal"
                      : "font-normal"
                  }
                >
                  {j.audience === "customer" ? "Customer-facing" : "Internal"}
                </Badge>
              </td>
              <td className="text-muted-foreground px-4 py-2">
                {formatDistanceToNowStrict(new Date(j.createdAt), { addSuffix: true })}
              </td>
              <td className="px-4 py-2 capitalize">{j.status}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  {j.status === "done" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      asChild
                      aria-label={`Download ${j.title} v${j.version}`}
                    >
                      <a href={`/api/exports/${j.id}/download`}>
                        <Download />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Re-run ${j.title} with fresh data`}
                    disabled={rerun.isPending}
                    onClick={() => rerun.mutate(j.id)}
                  >
                    <RotateCw
                      className={rerun.isPending && rerun.variables === j.id ? "animate-spin" : ""}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${j.title}`}
                    onClick={() => del.mutate(j.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
