import { z } from "zod";
import { fetchJson } from "../http";
import type { DataAdapter, NormalizedSignal } from "../types";
import { rollupJobs } from "./jobs-rollup";

export const LeverSchema = z.array(
  z.object({
    text: z.string(),
    hostedUrl: z.string().nullable().optional(),
    createdAt: z.number().nullable().optional(),
    categories: z
      .object({
        team: z.string().nullable().optional(),
        department: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
      })
      .partial()
      .nullable()
      .optional(),
  }),
);
export type LeverRaw = z.infer<typeof LeverSchema>;

export const leverAdapter: DataAdapter<NormalizedSignal, LeverRaw> = {
  id: "lever",
  label: "Lever job boards",
  kind: "public",
  description: "Public job postings when an account has a Lever board slug.",
  rawSchema: LeverSchema,
  eligible: (a) => !!a.sourceConfig.leverSlug,
  async fetch(ctx) {
    const out: NormalizedSignal[] = [];
    for (const account of ctx.accounts.filter(this.eligible!)) {
      const slug = encodeURIComponent(account.sourceConfig.leverSlug!);
      const raw = LeverSchema.parse(
        await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
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
    const jobs = raw.map((j) => ({
      title: j.text,
      url: j.hostedUrl ?? null,
      location: j.categories?.location ?? null,
      department: j.categories?.team ?? j.categories?.department ?? null,
      postedAt: j.createdAt ? new Date(j.createdAt) : null,
    }));
    return rollupJobs(
      account,
      jobs,
      "lever",
      `https://jobs.lever.co/${account.sourceConfig.leverSlug}`,
      now,
    );
  },
};
