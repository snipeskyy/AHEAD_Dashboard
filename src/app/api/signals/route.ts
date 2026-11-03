import { z } from "zod";
import { querySignals } from "@/lib/server/signals";
import { handler, json } from "@/lib/server/http";

const Query = z.object({
  accountId: z.string().optional(),
  types: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined)),
  minRelevance: z.coerce.number().min(0).max(100).optional(),
  sinceDays: z.coerce.number().min(0).max(3650).optional(),
  starred: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(["recent", "relevance"]).default("recent"),
});

/** Cursor-paginated signals. Phase 3 adds actions, SSE, and richer filters. */
export const GET = handler(async (req: Request) => {
  const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return json(
    await querySignals({
      ...q,
      since:
        q.sinceDays !== undefined ? new Date(Date.now() - q.sinceDays * 86_400_000) : undefined,
    }),
  );
});
