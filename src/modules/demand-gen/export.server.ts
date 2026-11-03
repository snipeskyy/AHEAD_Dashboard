import "server-only";
import { day } from "@/lib/export/build-helpers";
import { perAccount } from "@/lib/export/build-helpers";
import type { SectionBuilders } from "@/lib/export/builder-types";
import { recommendForAccount } from "@/lib/server/plays";

export const builders: SectionBuilders = {
  "demand-gen.recommended-plays": (ctx) =>
    perAccount(ctx, async (acc) => {
      const { items } = await recommendForAccount(acc.id, 3);
      if (!items.length)
        return [
          { kind: "paragraph", text: "No strong play recommendation right now.", field: "plays" },
        ];
      return [
        {
          kind: "list",
          ordered: true,
          field: "plays",
          items: items.map((r) => ({
            text: `${r.play.name} (fit ${r.score})`,
            sub: r.reasons
              .slice(0, 3)
              .map((x) => x.text)
              .join("; "),
            field: "why",
          })),
        },
      ];
    }),
  "demand-gen.engagement": async (ctx) => {
    const accountIds = ctx.accounts.map((a) => a.id);
    const since = new Date(ctx.now.getTime() - 90 * 86_400_000);
    const [touches, meetings, upcoming] = await Promise.all([
      ctx.db.touch.count({ where: { accountId: { in: accountIds }, completedAt: { gte: since } } }),
      ctx.db.touch.count({
        where: {
          accountId: { in: accountIds },
          completedAt: { gte: since },
          outcome: { in: ["meeting", "opp-created"] },
        },
      }),
      ctx.db.eventInvite.findMany({
        where: { accountId: { in: accountIds }, event: { startsAt: { gte: ctx.now } } },
        include: { event: true, account: { select: { name: true } } },
        orderBy: { event: { startsAt: "asc" } },
        take: 10,
      }),
    ]);
    return [
      {
        kind: "kv",
        items: [
          { label: "Touches (last 90 days)", value: String(touches), field: "touches" },
          { label: "Meetings (last 90 days)", value: String(meetings), field: "touches" },
        ],
      },
      upcoming.length
        ? {
            kind: "list",
            field: "events",
            items: upcoming.map((i) => ({
              text: i.event.name,
              sub: `${day(i.event.startsAt)}${i.event.location ? ` · ${i.event.location}` : ""}${ctx.accounts.length > 1 ? ` · ${i.account.name}` : ""}`,
            })),
          }
        : {
            kind: "paragraph",
            text: "No upcoming events or briefings scheduled.",
            field: "events",
          },
    ];
  },
};
