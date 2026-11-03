import { z } from "zod";
import { fetchJson } from "../http";
import type { DataAdapter, NormalizedSignal } from "../types";
import { rollupJobs } from "./jobs-rollup";

export const GreenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      absolute_url: z.string().nullable().optional(),
      updated_at: z.string().nullable().optional(),
      location: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
      departments: z.array(z.object({ name: z.string() })).optional(),
    }),
  ),
});
export type GreenhouseRaw = z.infer<typeof GreenhouseSchema>;

export const greenhouseAdapter: DataAdapter<NormalizedSignal, GreenhouseRaw> = {
  id: "greenhouse",
  label: "Greenhouse job boards",
  kind: "public",
  description:
    "Public job postings (hiring signals, initiative and tech-stack evidence) when a board slug is set.",
  rawSchema: GreenhouseSchema,
  eligible: (a) => !!a.sourceConfig.greenhouseSlug,
  async fetch(ctx) {
    const out: NormalizedSignal[] = [];
    for (const account of ctx.accounts.filter(this.eligible!)) {
      const slug = encodeURIComponent(account.sourceConfig.greenhouseSlug!);
      const raw = GreenhouseSchema.parse(
        await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, {
          db: ctx.db,
          ttlMs: 6 * 3600_000,
          minIntervalMs: 1000,
          signal: ctx.signal,
        }),
      );
      out.push(...this.normalize(raw, { account, now: ctx.now }));
    }
    return out;
  },
  normalize(raw, { account, now }) {
    const jobs = raw.jobs.map((j) => ({
      title: j.title,
      url: j.absolute_url ?? null,
      location: j.location?.name ?? null,
      department: j.departments?.[0]?.name ?? null,
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    }));
    return rollupJobs(
      account,
      jobs,
      "greenhouse",
      `https://boards.greenhouse.io/${account.sourceConfig.greenhouseSlug}`,
      now,
    );
  },
};
