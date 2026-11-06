/** Per-account enrichment status (pure): Not enriched / Queued / Running / Review needed / Up to date / Stale. */
export type EnrichStatus =
  "not-enriched" | "queued" | "running" | "review" | "up-to-date" | "stale" | "failed";

export const STATUS_LABEL: Record<EnrichStatus, string> = {
  "not-enriched": "Not enriched",
  queued: "Queued",
  running: "Running",
  review: "Review needed",
  "up-to-date": "Up to date",
  stale: "Stale",
  failed: "Failed",
};

export function enrichStatus(input: {
  job: { status: string } | null;
  runs: Array<{ enricherId: string; finishedAt: Date | null; ok: boolean }>;
  pending: number;
  ttlDays: Record<string, number>;
  now: Date;
}): EnrichStatus {
  if (input.job?.status === "queued") return "queued";
  if (input.job?.status === "running") return "running";
  const done = input.runs.filter((r) => r.finishedAt);
  if (!done.length) return input.job?.status === "failed" ? "failed" : "not-enriched";
  if (input.pending > 0) return "review";
  const latest = new Map<string, { at: number; ok: boolean }>();
  for (const r of done) {
    const prev = latest.get(r.enricherId);
    if (!prev || r.finishedAt!.getTime() > prev.at)
      latest.set(r.enricherId, { at: r.finishedAt!.getTime(), ok: r.ok });
  }
  for (const [id, r] of latest) {
    const ttl = input.ttlDays[id];
    if (ttl && r.ok && input.now.getTime() - r.at > ttl * 86_400_000) return "stale";
  }
  if ([...latest.values()].every((r) => !r.ok)) return "failed";
  return "up-to-date";
}
