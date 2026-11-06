import "server-only";
import { db } from "@/lib/db";
import { forCadence, forDeal, forFiscal, forMeeting, forSignal, forTask } from "@/lib/daily/next-action";
import { getSetting } from "@/lib/settings/server";
import { listMeetings } from "./meetings";
import { listOpportunities, stalledDays } from "./opportunities";
import { querySignalsByIds } from "./signals";
import { listTasks } from "./tasks";
import { territory } from "./territory";

const DAY = 86_400_000;

/** Everything for the My Day landing page; every item carries a suggested next action and its reason. */
export async function myDay(now = new Date()) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfDay.getTime() + 2 * DAY - 1);
  const lastSeenRaw = await getSetting("myDay.lastSeenAt");
  const since = lastSeenRaw ? new Date(lastSeenRaw) : new Date(now.getTime() - DAY);

  const [meetings, sigIds, tasks, terr, opps, stalled] = await Promise.all([
    listMeetings(startOfDay, endOfTomorrow),
    db.signal.findMany({
      where: { createdAt: { gte: since }, dismissed: false },
      orderBy: { relevance: "desc" },
      take: 10,
      select: { id: true },
    }),
    listTasks({ status: "open", due: "today" }),
    territory(now),
    listOpportunities({ stage: { notIn: ["ClosedWon", "ClosedLost"] } }),
    stalledDays(),
  ]);
  let ids = sigIds.map((s) => s.id);
  if (ids.length < 5)
    ids = (await db.signal.findMany({ where: { publishedAt: { gte: new Date(now.getTime() - 3 * DAY) }, dismissed: false }, orderBy: { relevance: "desc" }, take: 10, select: { id: true } })).map((s) => s.id);
  const signals = (await querySignalsByIds(ids)).sort((a, b) => b.relevance - a.relevance);

  const deals = opps
    .map((o) => {
      const closeInDays = Math.ceil((Date.parse(o.closeDate) - now.getTime()) / DAY);
      const hasNext = !!o.nextStepDate && Date.parse(o.nextStepDate) >= startOfDay.getTime() - DAY;
      const isStalled = o.riskFlags.includes("stalled");
      return { o, closeInDays, hasNext, isStalled };
    })
    .filter((x) => x.closeInDays <= 30 || x.isStalled || !x.hasNext)
    .sort((a, b) => Number(b.closeInDays <= 30) - Number(a.closeInDays <= 30) || a.closeInDays - b.closeInDays)
    .slice(0, 10)
    .map(({ o, closeInDays, hasNext, isStalled }) => ({
      id: o.id, name: o.name, accountId: o.accountId, accountName: o.accountName, stage: o.stage, amount: o.amount,
      closeDate: o.closeDate, closeInDays, stalled: isStalled,
      suggestion: forDeal({ closeInDays, stalledDays: isStalled ? o.daysInStage : null, hasNextStepDate: hasNext, meddpiccScore: o.meddpiccScore }, stalled),
    }));

  return {
    now: now.toISOString(),
    since: since.toISOString(),
    meetings: meetings.map((m) => ({
      id: m.id, title: m.title, startsAt: m.startsAt.toISOString(), endsAt: m.endsAt?.toISOString() ?? null, location: m.location, account: m.account,
      suggestion: forMeeting({ accountName: m.account?.name ?? null, minutesUntil: Math.round((m.startsAt.getTime() - now.getTime()) / 60_000) }),
    })),
    signals: signals.map((s) => ({ ...s, suggestion: forSignal({ type: s.type, practiceTags: s.practiceTags, relevance: s.relevance, accountName: s.accountName }) })),
    tasks: tasks.map((t) => ({
      ...t,
      suggestion: forTask({ dueInDays: t.dueDate ? Math.floor((t.dueDate.getTime() - startOfDay.getTime()) / DAY) : null }),
    })),
    cadence: terr.neglected.slice(0, 8).map((r) => ({
      id: r.id, name: r.name, tier: r.tier, daysSinceTouch: r.cadence.daysSinceTouch,
      suggestion: forCadence({ name: r.name, tier: r.tier, daysSinceTouch: r.cadence.daysSinceTouch, cadence: r.cadenceDays }),
    })),
    deals,
    fiscal: terr.rows
      .filter((r) => r.fiscal && (r.fiscal.phase === "in-window" || r.fiscal.weeksUntilStart <= 4))
      .slice(0, 6)
      .map((r) => ({ id: r.id, name: r.name, label: r.fiscal!.label, suggestion: forFiscal({ accountName: r.name, label: r.fiscal!.label }) })),
  };
}
export type MyDay = Awaited<ReturnType<typeof myDay>>;
