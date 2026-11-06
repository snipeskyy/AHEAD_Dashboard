"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { KIND_DEFS } from "@/lib/import/kinds";
import type { ImportKind } from "@/lib/import/types";
import type { CommitResult } from "./review-step";
import { UndoImportDialog } from "./undo-dialog";
import { useEnqueue } from "@/modules/account-intel/hooks/use-enrichment";

const NEXT: Partial<Record<ImportKind, { href: string; label: string }>> = {
  accounts: { href: "/accounts", label: "Open accounts" },
  contacts: { href: "/accounts", label: "Open accounts" },
  opportunities: { href: "/opportunities", label: "Open pipeline" },
  notes: { href: "/accounts", label: "Open accounts" },
  "partner-reps": { href: "/import?tab=history", label: "Import history" },
};

/** Step 5: what happened, undo, and what to do next (for accounts: fetch public data). */
export function ResultStep({
  kind,
  result,
  onAgain,
}: {
  kind: ImportKind;
  result: CommitResult;
  onAgain: () => void;
}) {
  const qc = useQueryClient();
  const def = KIND_DEFS[kind];
  const c = result.counts;
  const enrich = useEnqueue();
  const news = useMutation({
    mutationFn: () =>
      api<{ updated: number }>("/api/sources/google-news", {
        method: "POST",
        json: { enabled: true, accountIds: result.createdAccounts },
      }),
    onSuccess: (r) => toast.success(`Google News turned on for ${r.updated} accounts`),
    onError: (e) => toast.error(e.message),
  });
  const fetch = useMutation({
    mutationFn: () =>
      api<{ jobs: number }>("/api/sources/fetch", {
        method: "POST",
        json: { accountIds: result.createdAccounts },
      }),
    onSuccess: (r) =>
      toast.success(`Queued public-source fetches for ${r.jobs} accounts`, {
        description: "New signals stream into Live Signals as they arrive.",
      }),
    onError: (e) => toast.error(e.message),
  });
  const next = NEXT[kind]!;

  return (
    <section className="bg-card grid gap-4 rounded-lg border p-6" aria-labelledby="done-h">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="text-good-text mt-0.5 size-6 shrink-0" aria-hidden />
        <div>
          <h2 id="done-h" className="text-base font-semibold">
            Import complete
          </h2>
          <p className="text-muted-foreground text-[13px]">
            {c.created} {c.created === 1 ? def.singular : def.label.toLowerCase()} created
            {c.merged ? `, ${c.merged} merged` : ""}
            {c.skipped ? `, ${c.skipped} skipped` : ""}
            {c.errors ? `, ${c.errors} with errors skipped` : ""}. You can undo this whole import
            from History at any time.
          </p>
        </div>
      </div>

      {kind === "accounts" && result.createdAccounts.length > 0 && (
        <div className="grid gap-3 rounded-lg border border-dashed p-4 md:grid-cols-2">
          <div className="grid gap-1.5 text-[13px]">
            <div className="flex items-center gap-1.5 font-semibold">
              <RefreshCw className="size-4" aria-hidden /> Fetch public signals now
            </div>
            <p className="text-muted-foreground text-xs">
              Runs the public sources you&apos;ve enabled (SEC filings for tickers, job boards with
              a slug, RSS feeds). Google News is opt-in: turn it on to get headlines.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={news.isPending || news.isSuccess}
                onClick={() => news.mutate()}
              >
                {news.isSuccess ? "Google News on" : "Turn on Google News (opt-in)"}
              </Button>
              <Button
                size="sm"
                className="w-fit"
                disabled={fetch.isPending || fetch.isSuccess}
                onClick={() => fetch.mutate()}
              >
                {fetch.isSuccess ? "Queued" : `Fetch for ${result.createdAccounts.length} accounts`}
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5 text-[13px]">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4" aria-hidden /> Enrich all imported accounts
            </div>
            <p className="text-muted-foreground text-xs">
              Fills firmographics, financials, hierarchy, initiative evidence and tech hypotheses
              from public sources, each with its source link, for your review.
            </p>
            <Button
              size="sm"
              className="w-fit"
              disabled={enrich.isPending || enrich.isSuccess}
              onClick={() => enrich.mutate({ accountIds: result.createdAccounts })}
            >
              {enrich.isSuccess ? "Queued" : `Enrich ${result.createdAccounts.length} accounts now`}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={next.href}>
            {next.label} <ArrowRight />
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onAgain}>
          Import more
        </Button>
        <UndoImportDialog
          batchId={result.batchId}
          onDone={() => {
            qc.invalidateQueries();
            onAgain();
          }}
          trigger={
            <Button size="sm" variant="ghost" className="ml-auto">
              <Undo2 /> Undo this import
            </Button>
          }
        />
      </div>
    </section>
  );
}
