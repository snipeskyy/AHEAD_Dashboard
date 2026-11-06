/**
 * One-line "suggested next action" for My Day items (pure). Every suggestion carries the reason it was made,
 * so nothing is a black box.
 */
import type { SignalType } from "@/lib/domain/enums";

export interface Suggestion {
  action: string;
  reason: string;
}

const SIGNAL_ACTION: Partial<Record<SignalType, string>> = {
  "exec-change": "Send a short welcome note and offer a 30-day briefing",
  "m-and-a": "Offer an integration / consolidation assessment",
  incident: "Check in with security leadership; offer a resilience review",
  hiring: "Reach the hiring manager's leader about the program behind the roles",
  earnings: "Reference their stated priorities in your next touch",
  funding: "Congratulate and ask what the new budget unlocks",
  expansion: "Offer capacity planning for the expansion",
  partnership: "Explore a joint play with the new partner",
  regulatory: "Offer a compliance readiness conversation",
  filing: "Read the filing section and note new initiatives",
  news: "Use it as a timely opener in your next touch",
};

export function forSignal(s: { type: string; practiceTags: string[]; relevance: number; accountName: string }): Suggestion {
  const action = SIGNAL_ACTION[s.type as SignalType] ?? "Review and decide: play, opportunity or dismiss";
  const practice = s.practiceTags.length ? ` · matches ${s.practiceTags.length} practice area${s.practiceTags.length === 1 ? "" : "s"}` : "";
  return { action, reason: `${s.type.replace(/-/g, " ")} signal at ${s.accountName}, relevance ${Math.round(s.relevance)}${practice}` };
}

export function forCadence(a: { name: string; tier: string; daysSinceTouch: number | null; cadence: number; topPlay?: string | null }): Suggestion {
  return {
    action: a.topPlay ? `Schedule a touch using “${a.topPlay}”` : "Schedule a touch this week",
    reason: a.daysSinceTouch === null ? `No touch logged yet (${a.tier} cadence: every ${a.cadence} days)` : `Last touch ${a.daysSinceTouch} days ago (${a.tier} cadence: every ${a.cadence} days)`,
  };
}

export function forDeal(o: { closeInDays: number; stalledDays: number | null; hasNextStepDate: boolean; meddpiccScore: number }, stalledThreshold: number): Suggestion {
  if (o.closeInDays < 0)
    return { action: "Update the close date or close the deal out", reason: `Close date passed ${-o.closeInDays} day${o.closeInDays === -1 ? "" : "s"} ago` };
  if (!o.hasNextStepDate) return { action: "Set a dated next step", reason: "Every open deal needs a next step with a date" };
  if (o.stalledDays !== null && o.stalledDays >= stalledThreshold)
    return { action: "Re-engage the champion and confirm the decision timeline", reason: `No stage change in ${o.stalledDays} days` };
  if (o.closeInDays <= 30 && o.meddpiccScore < 60)
    return { action: "Close MEDDPICC gaps before the close date", reason: `Closes in ${o.closeInDays} days with MEDDPICC ${o.meddpiccScore}%` };
  return { action: "Confirm paper process and close plan", reason: `Closes in ${o.closeInDays} days` };
}

export function forTask(t: { dueInDays: number | null }): Suggestion {
  if (t.dueInDays === null) return { action: "Do it or give it a date", reason: "No due date" };
  if (t.dueInDays < 0) return { action: "Do it today or reschedule", reason: `Overdue by ${-t.dueInDays} day${t.dueInDays === -1 ? "" : "s"}` };
  return { action: "Do it today", reason: t.dueInDays === 0 ? "Due today" : `Due in ${t.dueInDays} days` };
}

export function forMeeting(m: { accountName: string | null; minutesUntil: number }): Suggestion {
  return m.accountName
    ? { action: "Open the prep brief", reason: `${m.minutesUntil > 0 ? `Starts in ${fmtMinutes(m.minutesUntil)}` : "In progress"} with ${m.accountName}` }
    : { action: "Link it to an account for a prep brief", reason: "No account matched the attendees' domains" };
}

const fmtMinutes = (m: number) => (m >= 120 ? `${Math.round(m / 60)} h` : `${m} min`);

export function forFiscal(f: { accountName: string; label: string }): Suggestion {
  return { action: "Get on the budget plan: share a sized proposal", reason: `${f.accountName}: ${f.label}` };
}
