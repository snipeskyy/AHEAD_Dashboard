import { describe, expect, it } from "vitest";
import { cadenceState } from "../cadence";
import { nextFiscalYearStart, planningWindow } from "../fiscal";
import { parseIcs, parseIcsDate } from "../ics";
import { forCadence, forDeal, forSignal, forTask } from "../next-action";
import { parseActions, parseTags } from "../notes-parser";
import { nextDue } from "../recurrence";
import { matches } from "../smart-lists";

const now = new Date("2026-11-06T15:00:00Z"); // a Friday

describe("fiscal timing", () => {
  it("finds the next fiscal-year start after the FYE", () => {
    expect(nextFiscalYearStart("1231", now)?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(nextFiscalYearStart("0630", now)?.toISOString().slice(0, 10)).toBe("2027-07-01");
    expect(nextFiscalYearStart("bad", now)).toBeNull();
  });
  it("labels the planning window", () => {
    expect(planningWindow("1231", now)?.phase).toBe("closing"); // window Aug 1 – Nov 1 for a Jan 1 fiscal year
    expect(planningWindow("0228", now)).toMatchObject({ phase: "in-window", label: expect.stringMatching(/underway/) }); // Oct 1 – Jan 1
    const june = planningWindow("0630", now)!;
    expect(june.phase).toBe("upcoming");
    expect(june.label).toMatch(/starts in ~\d+ weeks/);
    expect(planningWindow(null, now)).toBeNull();
  });
});

describe("cadence", () => {
  it("flags overdue, due-soon and never-touched accounts", () => {
    expect(cadenceState("Strategic", new Date("2026-10-01T00:00:00Z"), now)).toMatchObject({ status: "overdue", daysSinceTouch: 36, overdueDays: 22 });
    expect(cadenceState("Growth", new Date("2026-10-10T00:00:00Z"), now).status).toBe("due-soon");
    expect(cadenceState("Maintain", null, now).status).toBe("never");
  });
});

describe("recurrence", () => {
  it("advances past the reference date", () => {
    expect(nextDue(new Date("2026-11-01T17:00:00Z"), "weekly", now).toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(nextDue(new Date("2026-01-31T17:00:00Z"), "monthly").toISOString().slice(0, 10)).toBe("2026-03-03");
    expect(nextDue(new Date("2026-11-01T17:00:00Z"), "quarterly").toISOString().slice(0, 10)).toBe("2027-02-01");
  });
});

describe("notes → tasks", () => {
  it("extracts action lines with due hints and tags", () => {
    const notes = "Met with infra team #ai #budget\nAction: send GPU sizing by Friday\n- [ ] Intro to security lead tomorrow\nNext step: workshop by 2026-11-20\nTODO book exec briefing\nnothing here";
    const a = parseActions(notes, now);
    expect(a.map((x) => x.title)).toEqual(["send GPU sizing", "Intro to security lead", "workshop", "book exec briefing"]);
    expect(a[0].dueDate?.toISOString().slice(0, 10)).toBe("2026-11-13");
    expect(a[1].dueDate?.toISOString().slice(0, 10)).toBe("2026-11-07");
    expect(a[2].dueDate?.toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(a[3].dueDate).toBeNull();
    expect(parseTags(notes)).toEqual(["ai", "budget"]);
  });
});

describe("ics", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:abc-1",
    "SUMMARY:Quarterly review\\, Example Holdings",
    "DTSTART:20261106T180000Z",
    "DTEND:20261106T190000Z",
    "LOCATION:Video call",
    "ORGANIZER;CN=Me:mailto:me@myco.example",
    "ATTENDEE;CN=Jordan Lee;ROLE=REQ-PARTICIPANT:mailto:jordan.lee@",
    " example.com",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:weekly-1",
    "SUMMARY:Standup",
    "DTSTART:20261102T150000Z",
    "RRULE:FREQ=WEEKLY;COUNT=4",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:x",
    "STATUS:CANCELLED",
    "SUMMARY:Gone",
    "DTSTART:20261106T100000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  it("keeps titles, times and attendee domains only; expands simple weekly recurrences", () => {
    const ev = parseIcs(ics, { from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-30T00:00:00Z") });
    const q = ev.find((e) => e.uid === "abc-1")!;
    expect(q).toMatchObject({ title: "Quarterly review, Example Holdings", location: "Video call" });
    expect(q.attendeeDomains.sort()).toEqual(["example.com", "myco.example"]);
    expect(JSON.stringify(ev)).not.toContain("jordan");
    expect(ev.filter((e) => e.uid === "weekly-1")).toHaveLength(4);
    expect(ev.some((e) => e.title === "Gone")).toBe(false);
    expect(parseIcsDate("20261225")?.toISOString()).toBe("2026-12-25T00:00:00.000Z");
  });
});

describe("suggested next actions carry reasons", () => {
  it("covers signals, cadence, deals and tasks", () => {
    expect(forSignal({ type: "exec-change", practiceTags: ["security"], relevance: 88.4, accountName: "Example" })).toMatchObject({ action: expect.stringMatching(/welcome/), reason: expect.stringMatching(/relevance 88/) });
    expect(forCadence({ name: "Example", tier: "Strategic", daysSinceTouch: 40, cadence: 14 }).reason).toMatch(/40 days ago/);
    expect(forDeal({ closeInDays: 10, stalledDays: 5, hasNextStepDate: false, meddpiccScore: 80 }, 30).action).toBe("Set a dated next step");
    expect(forDeal({ closeInDays: 10, stalledDays: 45, hasNextStepDate: true, meddpiccScore: 80 }, 30).reason).toMatch(/45 days/);
    expect(forTask({ dueInDays: -2 }).reason).toBe("Overdue by 2 days");
  });
});

describe("smart lists", () => {
  const row = { tier: "Strategic", initiativePractices: ["ai-infra"], openOppPractices: [], healthScore: 42, lastTouchAt: "2026-09-01T00:00:00Z", name: "Example Holdings" };
  it("evaluates all/any rules across field types", () => {
    const strategicAiNoAiOpp = { match: "all" as const, rules: [
      { field: "tier", op: "in", value: ["Strategic"] },
      { field: "initiativePractices", op: "has", value: ["ai-infra"] },
      { field: "openOppPractices", op: "lacks", value: ["ai-infra"] },
    ] };
    expect(matches(row, strategicAiNoAiOpp, now)).toBe(true);
    expect(matches(row, { match: "all", rules: [{ field: "healthScore", op: "gte", value: 50 }] }, now)).toBe(false);
    expect(matches(row, { match: "any", rules: [{ field: "healthScore", op: "gte", value: 50 }, { field: "lastTouchAt", op: "olderThanDays", value: 30 }] }, now)).toBe(true);
    expect(matches(row, { match: "all", rules: [{ field: "name", op: "contains", value: "holdings" }] }, now)).toBe(true);
  });
});

describe("forDeal past close date", () => {
  it("says the close date passed instead of a negative countdown", async () => {
    const { forDeal } = await import("../next-action");
    const s = forDeal({ closeInDays: -24, stalledDays: null, hasNextStepDate: true, meddpiccScore: 20 }, 21);
    expect(s.reason).toBe("Close date passed 24 days ago");
  });
});
