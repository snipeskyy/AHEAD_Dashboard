import "server-only";
import { db } from "@/lib/db";
import { GENERIC_DOMAINS, parseIcs } from "@/lib/daily/ics";
import { logActivity } from "./activity";
import { HttpError } from "./http";

const DAY = 86_400_000;

/**
 * Imports an exported calendar (.ics): events from yesterday to 60 days out. Matches each meeting to an account
 * by attendee domain, ignoring webmail/conferencing domains and your own domain (the one on most meetings).
 */
export async function importIcs(text: string, now = new Date()) {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new HttpError(400, "That doesn't look like a calendar (.ics) file");
  const events = parseIcs(text, { from: new Date(now.getTime() - DAY), to: new Date(now.getTime() + 60 * DAY) });
  const counts = new Map<string, number>();
  for (const e of events) for (const d of new Set(e.attendeeDomains)) counts.set(d, (counts.get(d) ?? 0) + 1);
  const withAttendees = events.filter((e) => e.attendeeDomains.length).length;
  const own = new Set([...counts].filter(([, n]) => withAttendees >= 3 && n / withAttendees >= 0.6).map(([d]) => d));
  const accounts = await db.account.findMany({ where: { domain: { not: null } }, select: { id: true, domain: true } });
  const byDomain = new Map(accounts.map((a) => [a.domain!.toLowerCase(), a.id]));
  const match = (domains: string[]) => {
    for (const d of domains) {
      if (GENERIC_DOMAINS.has(d) || own.has(d)) continue;
      const parts = d.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        const id = byDomain.get(parts.slice(i).join("."));
        if (id) return id;
      }
    }
    return null;
  };
  let matched = 0;
  for (const e of events) {
    const accountId = match(e.attendeeDomains);
    if (accountId) matched++;
    const data = { title: e.title, endsAt: e.endsAt, location: e.location, attendeeDomains: e.attendeeDomains.filter((d) => !own.has(d)), accountId };
    await db.meeting.upsert({
      where: { uid_startsAt: { uid: e.uid, startsAt: e.startsAt } },
      create: { uid: e.uid, startsAt: e.startsAt, ...data },
      update: data,
    });
  }
  await logActivity({ entityType: "workspace", entityId: "calendar", action: "calendar.imported", summary: `Imported ${events.length} meetings (${matched} matched to accounts)` });
  return { imported: events.length, matched, ignoredDomains: [...own] };
}

export function listMeetings(from: Date, to: Date) {
  return db.meeting.findMany({
    where: { startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: "asc" },
    include: { account: { select: { id: true, name: true } } },
    take: 300,
  });
}
