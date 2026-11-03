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
  accountIds?: string[];
  types?: string[];
  practices?: string[];
  sources?: string[];
  tiers?: string[];
  q?: string;
  minRelevance?: number;
  since?: Date;
  until?: Date;
  includeDismissed?: boolean;
  starred?: boolean;
  unread?: boolean;
  inNextSummary?: boolean;
  demo?: "only" | "exclude";
  cursor?: string; // signal id
  limit?: number;
  sort?: "recent" | "relevance";
}

export function signalWhere(q: SignalQuery): Prisma.SignalWhereInput {
  const and: Prisma.SignalWhereInput[] = [];
  if (q.practices?.length)
    and.push({ OR: q.practices.map((p) => ({ tagIndex: { contains: `,${p},` } })) });
  if (q.q?.trim())
    and.push({ OR: [{ title: { contains: q.q.trim() } }, { summary: { contains: q.q.trim() } }] });
  return {
    accountId: q.accountId ?? (q.accountIds?.length ? { in: q.accountIds } : undefined),
    type: q.types?.length ? { in: q.types } : undefined,
    source: q.sources?.length ? { in: q.sources } : undefined,
    account: q.tiers?.length ? { tier: { in: q.tiers } } : undefined,
    relevance: q.minRelevance ? { gte: q.minRelevance } : undefined,
    publishedAt: q.since || q.until ? { gte: q.since, lte: q.until } : undefined,
    dismissed: q.includeDismissed ? undefined : false,
    starred: q.starred ? true : undefined,
    read: q.unread ? false : undefined,
    inNextSummary: q.inNextSummary ? true : undefined,
    isDemo: q.demo === "only" ? true : q.demo === "exclude" ? false : undefined,
    AND: and.length ? and : undefined,
  };
}

/** Server-side filtered, cursor-paginated signal list (15k+ rows never reach the browser at once). */
export async function querySignals(q: SignalQuery) {
  const limit = Math.min(q.limit ?? 50, 200);
  const where = signalWhere(q);
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
    items: page.map(toSignalRow),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

type SignalWithAccount = Prisma.SignalGetPayload<{
  include: { account: { select: { name: true; tier: true } } };
}>;

export function toSignalRow(s: SignalWithAccount): SignalRow {
  return {
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
  };
}

export async function querySignalsByIds(ids: string[]): Promise<SignalRow[]> {
  const rows = await db.signal.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" },
    include: { account: { select: { name: true, tier: true } } },
  });
  return rows.map(toSignalRow);
}
