import { z } from "zod";
import { db } from "@/lib/db";
import { search } from "@/lib/search";
import { handler, json } from "@/lib/server/http";

const Query = z.object({
  q: z.string().trim().min(1).max(200),
  types: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",") : undefined))
    .pipe(z.array(z.enum(["account", "signal", "opportunity", "note", "play"])).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const { q, types, limit } = Query.parse(Object.fromEntries(url.searchParams));
  const hits = await search.search(q, { types, limit });
  // Attach account names for context in the palette.
  const accountIds = [...new Set(hits.map((h) => h.accountId).filter((x): x is string => !!x))];
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, name: true },
  });
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  return json({
    hits: hits.map((h) => ({
      ...h,
      accountName: h.accountId ? (names.get(h.accountId) ?? null) : null,
    })),
  });
});
