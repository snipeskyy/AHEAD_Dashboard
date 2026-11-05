"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface SourceResult {
  adapterId: string;
  ok: boolean;
  skipped: string | null;
  inserted: number;
  error: string | null;
}
interface Job {
  status: "pending" | "running" | "done" | "failed";
  result: { message: string; sources?: SourceResult[] } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls a queued job until the worker finishes it (or ~2 minutes pass). */
async function waitForJob(id: string): Promise<Job | null> {
  for (let i = 0; i < 60; i++) {
    await sleep(i < 5 ? 1000 : 2000);
    const job = await api<Job>(`/api/jobs/${id}`);
    if (job.status === "done" || job.status === "failed") return job;
  }
  return null;
}

/**
 * "Fetch now" that reports what actually happened: per-source new signals, skips and errors.
 * If the worker never picks the job up, it says so (the worker runs with `npm run dev` / `npm start`).
 */
export function useFetchNow(accountId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { jobId } = await api<{ jobId: string }>("/api/sources/fetch", {
        method: "POST",
        json: accountId ? { accountId } : {},
      });
      qc.invalidateQueries({ queryKey: ["sources"] });
      return waitForJob(jobId);
    },
    onMutate: () => toast.loading("Fetching public sources…", { id: "fetch-now" }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["signals"] });
      if (!job)
        return toast.warning("The background worker hasn't picked this up", {
          id: "fetch-now",
          description:
            "Start the app with `npm start` (or `npm run dev`), which runs the web app and the worker together.",
        });
      const ran = (job.result?.sources ?? []).filter((s) => !s.skipped);
      const added = ran.reduce((n, s) => n + s.inserted, 0);
      const failed = ran.filter((s) => !s.ok);
      if (!ran.length)
        return toast.warning("No public source could run", {
          id: "fetch-now",
          description: "See “Source coverage” on Live Signals for what to switch on.",
        });
      const desc = [
        ...ran.filter((s) => s.ok).map((s) => `${s.adapterId}: +${s.inserted}`),
        ...failed.map((s) => `${s.adapterId}: ${s.error ?? "failed"}`),
      ].join(" · ");
      const fn = failed.length && !added ? toast.error : toast.success;
      fn(added ? `${added} new signal${added === 1 ? "" : "s"}` : "No new signals this time", {
        id: "fetch-now",
        description: desc,
      });
    },
    onError: (e) => toast.error(e.message, { id: "fetch-now" }),
  });
}
