/**
 * Minimal RFC 5545 reader for exported calendars (pure). Keeps title, times, location and attendee DOMAINS only
 * (never addresses or names). Recurring events: the first occurrence plus weekly/daily repeats within the window.
 */
export interface IcsEvent {
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  attendeeDomains: string[];
}

const unfold = (text: string) => text.replace(/\r?\n[ \t]/g, "");
const unescape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** DTSTART value → Date. Handles UTC (Z), floating local and all-day (VALUE=DATE). TZID is treated as local time. */
export function parseIcsDate(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  return z || !m[4]
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

export function parseIcs(text: string, window?: { from: Date; to: Date }): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const block of unfold(text).split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const props = new Map<string, Array<{ params: string; value: string }>>();
    for (const line of body.split(/\r?\n/)) {
      const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (!m) continue;
      props.set(m[1], [...(props.get(m[1]) ?? []), { params: m[2], value: m[3] }]);
    }
    const get = (k: string) => props.get(k)?.[0]?.value;
    if (/CANCELLED/i.test(get("STATUS") ?? "")) continue;
    const start = parseIcsDate(get("DTSTART") ?? "");
    if (!start) continue;
    const end = parseIcsDate(get("DTEND") ?? "");
    const domains = new Set<string>();
    for (const a of [...(props.get("ATTENDEE") ?? []), ...(props.get("ORGANIZER") ?? [])]) {
      const mail = /mailto:([^;\s]+)/i.exec(a.value)?.[1];
      const dom = mail?.split("@")[1]?.toLowerCase().replace(/[>"]/g, "");
      if (dom) domains.add(dom);
    }
    const base: IcsEvent = {
      uid: get("UID") ?? `${start.toISOString()}-${get("SUMMARY") ?? ""}`,
      title: unescape(get("SUMMARY") ?? "(No title)").slice(0, 200),
      startsAt: start,
      endsAt: end,
      location: get("LOCATION") ? unescape(get("LOCATION")!).slice(0, 200) : null,
      attendeeDomains: [...domains],
    };
    out.push(base);
    const rrule = get("RRULE");
    const freq = rrule && /FREQ=(DAILY|WEEKLY)/.exec(rrule)?.[1];
    if (freq && window) {
      const step = (freq === "DAILY" ? 1 : 7 * Number(/INTERVAL=(\d+)/.exec(rrule!)?.[1] ?? 1)) * 86_400_000;
      const until = /UNTIL=([0-9TZ]+)/.exec(rrule!)?.[1];
      const count = Number(/COUNT=(\d+)/.exec(rrule!)?.[1] ?? 0);
      const stop = until ? parseIcsDate(until) : null;
      const dur = end ? end.getTime() - start.getTime() : 0;
      for (let i = 1, t = start.getTime() + step; t <= window.to.getTime() && (!count || i < count) && (!stop || t <= stop.getTime()); i++, t += step)
        if (t >= window.from.getTime()) out.push({ ...base, startsAt: new Date(t), endsAt: end ? new Date(t + dur) : null });
    }
  }
  return window ? out.filter((e) => e.startsAt >= window.from && e.startsAt <= window.to) : out;
}

/** Calendar/meeting-host domains never identify a customer. */
export const GENERIC_DOMAINS = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "live.com", "me.com", "zoom.us", "teams.microsoft.com", "google.com", "calendar.google.com", "group.calendar.google.com"]);
