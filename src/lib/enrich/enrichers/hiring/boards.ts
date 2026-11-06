/** Public job-board APIs (no keys): Greenhouse, Lever, Ashby, SmartRecruiters → a common posting shape. */
import { z } from "zod";
import type { EnrichContext, JobBoardProvider } from "../../types";

export interface Posting {
  title: string;
  department: string | null;
  location: string | null;
  url: string | null;
}

const GH = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      absolute_url: z.string().nullish(),
      location: z.object({ name: z.string().nullish() }).nullish(),
      departments: z.array(z.object({ name: z.string() })).nullish(),
    }),
  ),
});
const LV = z.array(
  z.object({
    text: z.string(),
    hostedUrl: z.string().nullish(),
    categories: z
      .object({
        team: z.string().nullish(),
        department: z.string().nullish(),
        location: z.string().nullish(),
      })
      .partial()
      .nullish(),
  }),
);
const AB = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      department: z.string().nullish(),
      team: z.string().nullish(),
      location: z.string().nullish(),
      jobUrl: z.string().nullish(),
      isListed: z.boolean().nullish(),
    }),
  ),
});
const SR = z.object({
  content: z.array(
    z.object({
      name: z.string(),
      department: z.object({ label: z.string().nullish() }).nullish(),
      function: z.object({ label: z.string().nullish() }).nullish(),
      location: z.object({ city: z.string().nullish(), country: z.string().nullish() }).nullish(),
      ref: z.string().nullish(),
    }),
  ),
});

export function boardUrl(p: JobBoardProvider, slug: string) {
  return {
    greenhouse: `https://boards.greenhouse.io/${slug}`,
    lever: `https://jobs.lever.co/${slug}`,
    ashby: `https://jobs.ashbyhq.com/${slug}`,
    smartrecruiters: `https://jobs.smartrecruiters.com/${slug}`,
  }[p];
}

export function normalizeBoard(p: JobBoardProvider, raw: unknown): Posting[] {
  switch (p) {
    case "greenhouse":
      return GH.parse(raw).jobs.map((j) => ({
        title: j.title,
        department: j.departments?.[0]?.name ?? null,
        location: j.location?.name ?? null,
        url: j.absolute_url ?? null,
      }));
    case "lever":
      return LV.parse(raw).map((j) => ({
        title: j.text,
        department: j.categories?.team ?? j.categories?.department ?? null,
        location: j.categories?.location ?? null,
        url: j.hostedUrl ?? null,
      }));
    case "ashby":
      return AB.parse(raw)
        .jobs.filter((j) => j.isListed !== false)
        .map((j) => ({
          title: j.title,
          department: j.department ?? j.team ?? null,
          location: j.location ?? null,
          url: j.jobUrl ?? null,
        }));
    case "smartrecruiters":
      return SR.parse(raw).content.map((j) => ({
        title: j.name,
        department: j.department?.label ?? j.function?.label ?? null,
        location:
          [j.location?.city, j.location?.country?.toUpperCase()].filter(Boolean).join(", ") || null,
        url: null,
      }));
  }
}

export async function fetchBoard(
  ctx: Pick<EnrichContext, "http">,
  p: JobBoardProvider,
  slug: string,
) {
  const s = encodeURIComponent(slug);
  const url = {
    greenhouse: `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`,
    lever: `https://api.lever.co/v0/postings/${s}?mode=json`,
    ashby: `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    smartrecruiters: `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`,
  }[p];
  return normalizeBoard(p, await ctx.http.json(url, { ttlMs: 6 * 3_600_000 }));
}
