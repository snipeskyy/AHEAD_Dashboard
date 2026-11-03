import "server-only";
import { practiceLabel } from "@/config/practice-areas";
import { day } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";

/** Signals the user flagged "add to next summary" first, then top relevance in the last 30 days. */
export const builders: SectionBuilders = {
  "signals.key-signals": async (ctx) => {
    const accountIds = ctx.accounts.map((a) => a.id);
    const since = new Date(ctx.now.getTime() - 30 * 86_400_000);
    const [flagged, top] = await Promise.all([
      ctx.db.signal.findMany({
        where: { accountId: { in: accountIds }, inNextSummary: true, dismissed: false },
        orderBy: { publishedAt: "desc" },
        take: 15,
        include: { account: { select: { name: true } } },
      }),
      ctx.db.signal.findMany({
        where: { accountId: { in: accountIds }, publishedAt: { gte: since }, dismissed: false },
        orderBy: { relevance: "desc" },
        take: 12,
        include: { account: { select: { name: true } } },
      }),
    ]);
    const seen = new Set<string>();
    const rows = [...flagged, ...top]
      .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
      .slice(0, 15);
    if (!rows.length)
      return [
        { kind: "paragraph", text: "No notable signals in the last 30 days.", field: "title" },
      ];
    const multi = ctx.accounts.length > 1;
    return [
      {
        kind: "table",
        field: "title",
        columns: [
          { key: "date", label: "Date", field: "title" },
          ...(multi ? [{ key: "account", label: "Account", field: "title" }] : []),
          { key: "title", label: "Signal", field: "title" },
          { key: "practice", label: "Practice", field: "practiceTags" },
          { key: "relevance", label: "Relevance", align: "right" as const, field: "relevance" },
        ],
        rows: rows.map((s) => ({
          date: { text: day(s.publishedAt) },
          account: { text: s.account.name },
          title: s.url
            ? { text: s.title, href: s.url }
            : { text: s.isDemo ? `${s.title} (demo)` : s.title },
          practice: {
            text: (s.practiceTags as string[]).map((t) => practiceLabel(t, true)).join(", ") || "—",
          },
          relevance: { text: String(Math.round(s.relevance)) },
        })),
      },
    ];
  },
};
