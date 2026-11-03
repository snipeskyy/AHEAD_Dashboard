import { db } from "@/lib/db";
import { BUYING_ROLES, TOUCH_CHANNELS } from "@/lib/domain/enums";
import { handler, json } from "@/lib/server/http";

const DAY = 86_400_000;
const weekStart = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};

/** Demand-gen metrics: activity, channel mix, persona coverage, touches per account, play effectiveness. */
export const GET = handler(async () => {
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * DAY);
  const [touches, planned, accounts, contacts, campaigns] = await Promise.all([
    db.touch.findMany({
      where: { completedAt: { gte: since90, lte: now } },
      select: {
        accountId: true,
        channel: true,
        outcome: true,
        completedAt: true,
        persona: true,
        campaign: { select: { playId: true } },
      },
    }),
    db.touch.count({
      where: {
        completedAt: null,
        scheduledAt: { gte: now, lte: new Date(now.getTime() + 30 * DAY) },
      },
    }),
    db.account.findMany({ select: { id: true, name: true, tier: true, lastTouchAt: true } }),
    db.contact.findMany({ select: { accountId: true, buyingRole: true, engagement: true } }),
    db.campaign.findMany({
      select: {
        playId: true,
        play: { select: { name: true } },
        touches: { select: { completedAt: true, outcome: true } },
      },
    }),
  ]);
  const replied = (o: string | null) => o === "replied" || o === "meeting" || o === "opp-created";
  const met = (o: string | null) => o === "meeting" || o === "opp-created";

  const weeks: string[] = [];
  for (let i = 11; i >= 0; i--) weeks.push(weekStart(new Date(now.getTime() - i * 7 * DAY)));
  const weekly = new Map(weeks.map((w) => [w, { week: w, touches: 0, meetings: 0 }]));
  for (const t of touches) {
    const w = weekly.get(weekStart(t.completedAt!));
    if (w) {
      w.touches++;
      if (met(t.outcome)) w.meetings++;
    }
  }

  const channels = TOUCH_CHANNELS.map((c) => {
    const xs = touches.filter((t) => t.channel === c);
    return {
      channel: c,
      touches: xs.length,
      replyRate: xs.length ? xs.filter((t) => replied(t.outcome)).length / xs.length : 0,
      meetingRate: xs.length ? xs.filter((t) => met(t.outcome)).length / xs.length : 0,
    };
  });

  const focus = accounts.filter((a) => a.tier !== "Maintain");
  const focusIds = new Set(focus.map((a) => a.id));
  const personaCoverage = BUYING_ROLES.map((role) => {
    const identified = new Set(
      contacts
        .filter((c) => c.buyingRole === role && focusIds.has(c.accountId))
        .map((c) => c.accountId),
    );
    const engaged = new Set(
      contacts
        .filter(
          (c) =>
            c.buyingRole === role &&
            focusIds.has(c.accountId) &&
            (c.engagement === "Engaged" || c.engagement === "Strong"),
        )
        .map((c) => c.accountId),
    );
    return {
      role,
      identified: identified.size / (focus.length || 1),
      engaged: engaged.size / (focus.length || 1),
    };
  });

  const perAccount = new Map<string, number>();
  for (const t of touches) perAccount.set(t.accountId, (perAccount.get(t.accountId) ?? 0) + 1);
  const accName = new Map(accounts.map((a) => [a.id, a]));
  const topAccounts = [...perAccount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, n]) => ({
      accountId: id,
      name: accName.get(id)?.name ?? id,
      tier: accName.get(id)?.tier ?? "",
      touches: n,
    }));
  const cold = accounts
    .filter(
      (a) =>
        a.tier === "Strategic" &&
        (!a.lastTouchAt || now.getTime() - a.lastTouchAt.getTime() > 45 * DAY),
    )
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      lastTouchAt: a.lastTouchAt?.toISOString() ?? null,
    }));

  const playMap = new Map<
    string,
    {
      playId: string;
      name: string;
      campaigns: number;
      touches: number;
      replies: number;
      meetings: number;
      opps: number;
    }
  >();
  for (const c of campaigns) {
    if (!c.playId) continue;
    const p = playMap.get(c.playId) ?? {
      playId: c.playId,
      name: c.play?.name ?? c.playId,
      campaigns: 0,
      touches: 0,
      replies: 0,
      meetings: 0,
      opps: 0,
    };
    p.campaigns++;
    for (const t of c.touches.filter((x) => x.completedAt)) {
      p.touches++;
      if (replied(t.outcome)) p.replies++;
      if (met(t.outcome)) p.meetings++;
      if (t.outcome === "opp-created") p.opps++;
    }
    playMap.set(c.playId, p);
  }

  return json({
    totals: {
      completed90: touches.length,
      planned30: planned,
      replyRate: touches.length
        ? touches.filter((t) => replied(t.outcome)).length / touches.length
        : 0,
      meetingRate: touches.length
        ? touches.filter((t) => met(t.outcome)).length / touches.length
        : 0,
      oppsCreated: touches.filter((t) => t.outcome === "opp-created").length,
      accountsTouched: perAccount.size,
    },
    weekly: [...weekly.values()],
    channels,
    personaCoverage,
    topAccounts,
    coldStrategic: cold,
    plays: [...playMap.values()].sort((a, b) => b.touches - a.touches),
  });
});
