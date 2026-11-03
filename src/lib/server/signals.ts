import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface SignalRow {
  id: string;
  accountId: string;
  accountName: string;
  accountTier: string;
  type: string;
  title: string;
  summary: string | null;
  url: string | null;
  source: string;
  publishedAt: string;
  practiceTags: string[];
  relevance: number;
  relevanceParts: Record<string, number>;
  read: boolean;
  starred: boolean;
  dismissed: boolean;
  inNextSummary: boolean;
  isDemo: boolean;
}

export interface SignalQuery {
  accountId?: string;
  types?: string[];
  minRelevance?: number;
  since?: Date;
  includeDismissed?: boolean;
  starred?: boolean;
  cursor?: string; // signal id
  limit?: number;
  sort?: "recent" | "relevance";
}

/** Server-side filtered, cursor-paginated signal list (15k+ rows never reach the browser at once). */
export async function querySignals(q: SignalQuery) {
  const limit = Math.min(q.limit ?? 50, 200);
  const where: Prisma.SignalWhereInput = {
    accountId: q.accountId,
    type: q.types?.length ? { in: q.types } : undefined,
    relevance: q.minRelevance ? { gte: q.minRelevance } : undefined,
    publishedAt: q.since ? { gte: q.since } : undefined,
    dismissed: q.includeDismissed ? undefined : false,
    starred: q.starred ? true : undefined,
  };
  const orderBy: Prisma.SignalOrderByWithRelationInput[] =
    q.sort === "relevance"
      ? [{ relevance: "desc" }, { id: "asc" }]
      : [{ publishedAt: "desc" }, { id: "asc" }];
  const rows = await db.signal.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { account: { select: { name: true, tier: true } } },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map<SignalRow>((s) => ({
      id: s.id,
      accountId: s.accountId,
      accountName: s.account.name,
      accountTier: s.account.tier,
      type: s.type,
      title: s.title,
      summary: s.summary,
      url: s.url,
      source: s.source,
      publishedAt: s.publishedAt.toISOString(),
      practiceTags: s.practiceTags as string[],
      relevance: s.relevance,
      relevanceParts: s.relevanceParts as Record<string, number>,
      read: s.read,
      starred: s.starred,
      dismissed: s.dismissed,
      inNextSummary: s.inNextSummary,
      isDemo: s.isDemo,
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}
