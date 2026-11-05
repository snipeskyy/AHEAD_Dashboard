"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, PlugZap, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { SourceCoverage } from "@/lib/adapters/coverage";
import { cn } from "@/lib/utils";

/**
 * Which public sources can run, for how many accounts, and a one-click fix when they can't.
 * Shown prominently when nothing can run (the usual reason "Fetch now" finds nothing).
 */
export function SourceCoveragePanel({
  coverage,
  runnable,
  compact = false,
}: {
  coverage: SourceCoverage[];
  runnable: number;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const enableNews = useMutation({
    mutationFn: () =>
      api<{ updated: number }>("/api/sources/google-news", {
        method: "POST",
        json: { enabled: true },
      }),
    onSuccess: (r) => {
      toast.success(`Google News turned on for ${r.updated} accounts`, {
        description: "Click Fetch now to pull headlines.",
      });
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section
      aria-labelledby="cov-h"
      className={cn(
        "bg-card grid gap-3 rounded-lg border p-4",
        runnable === 0 && "border-warning/60",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="cov-h" className="flex items-center gap-1.5 text-sm font-semibold">
            {runnable === 0 ? (
              <TriangleAlert className="text-warning-text size-4" aria-hidden />
            ) : (
              <PlugZap className="size-4" aria-hidden />
            )}
            Source coverage
          </h2>
          <p className="text-muted-foreground text-xs">
            {runnable === 0
              ? "No public source can run for your accounts yet, so Fetch now has nothing to fetch. Fix one of these:"
              : "What Fetch now (and the 30-minute schedule) will query."}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings?tab=sources">Data source settings</Link>
        </Button>
      </header>
      <ul className={cn("grid gap-2", !compact && "md:grid-cols-2")}>
        {coverage.map((c) => {
          const ok = c.enabled && c.eligible > 0;
          return (
            <li key={c.id} className="flex items-start gap-2 text-[13px]">
              {ok ? (
                <CheckCircle2
                  className="text-good-text mt-0.5 size-4 shrink-0"
                  aria-label="Running"
                />
              ) : (
                <CircleSlash
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  aria-label="Not running"
                />
              )}
              <div className="min-w-0">
                <div className="font-medium">
                  {c.label}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {c.eligible} of {c.total} accounts
                  </span>
                </div>
                {c.hint && <p className="text-muted-foreground text-xs">{c.hint}</p>}
                {c.action === "enable-google-news" && (
                  <Button
                    size="sm"
                    className="mt-1.5 h-7"
                    disabled={enableNews.isPending || !c.total}
                    onClick={() => enableNews.mutate()}
                  >
                    Turn on for all {c.total} accounts
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
