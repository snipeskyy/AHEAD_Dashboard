import { TOUCH_CHANNELS } from "../../../src/lib/domain/enums";
import { daysFrom, type Rng } from "../rng";

const ANGLES = [
  "AI readiness point of view",
  "Consolidation economics",
  "Recovery readiness",
  "FinOps benchmark",
  "Integration facility tour",
  "New-exec baseline",
  "Platform maturity",
  "ESM roadmap",
  "Quarterly business review",
  "Event follow-up",
];

export function generateTouch(
  rng: Rng,
  i: number,
  accountId: string,
  personas: string[],
  anchor: Date,
  campaignId: string | null,
) {
  const future = rng.bool(0.18);
  const scheduledAt = daysFrom(anchor, future ? rng.int(0, 45) : -rng.int(0, 150));
  scheduledAt.setUTCHours(rng.int(13, 22), rng.pick([0, 15, 30, 45]), 0, 0);
  const completed = !future;
  return {
    id: `demo-touch-${String(i).padStart(5, "0")}`,
    accountId,
    campaignId,
    channel: rng.weighted(
      TOUCH_CHANNELS.map(
        (c) =>
          [
            c,
            c === "email" ? 5 : c === "linkedin" ? 3 : c === "call" ? 3 : c === "meeting" ? 2 : 1,
          ] as const,
      ),
    ),
    persona: personas.length ? rng.pick(personas) : "Chief Information Officer",
    angle: rng.pick(ANGLES),
    scheduledAt,
    completedAt: completed ? scheduledAt : null,
    outcome: completed
      ? rng.weighted([
          ["no-response", 50],
          ["replied", 28],
          ["meeting", 16],
          ["opp-created", 6],
        ] as const)
      : null,
    isDemo: true,
  };
}

export const SEED_EVENTS: Array<{
  name: string;
  kind: string;
  offsetDays: number;
  location: string | null;
}> = [
  {
    name: "AI Infrastructure Executive Roundtable",
    kind: "roundtable",
    offsetDays: 12,
    location: "Chicago, IL",
  },
  {
    name: "Modern Data Center Summit (regional)",
    kind: "conference",
    offsetDays: 26,
    location: "Dallas, TX",
  },
  {
    name: "Ransomware Recovery Tabletop Workshop",
    kind: "briefing",
    offsetDays: 8,
    location: "Virtual",
  },
  { name: "Integration Facility Open House", kind: "partner", offsetDays: 33, location: "On-site" },
  { name: "FinOps in Practice Webinar", kind: "webinar", offsetDays: 5, location: "Virtual" },
  { name: "Platform Engineering Meetup", kind: "partner", offsetDays: 19, location: "Denver, CO" },
  {
    name: "CIO Dinner Series — Spring",
    kind: "roundtable",
    offsetDays: 47,
    location: "Atlanta, GA",
  },
  { name: "Liquid Cooling Deep-Dive", kind: "webinar", offsetDays: 40, location: "Virtual" },
  {
    name: "Healthcare IT Resilience Forum",
    kind: "conference",
    offsetDays: 61,
    location: "Nashville, TN",
  },
  { name: "ESM Customer Exchange", kind: "partner", offsetDays: 54, location: "Columbus, OH" },
  {
    name: "Hyperscaler A Co-Sell Day",
    kind: "partner",
    offsetDays: -6,
    location: "Minneapolis, MN",
  },
  {
    name: "Executive Briefing: Data for AI",
    kind: "briefing",
    offsetDays: -14,
    location: "Charlotte, NC",
  },
  {
    name: "Security Leaders Breakfast",
    kind: "roundtable",
    offsetDays: -21,
    location: "Boston, MA",
  },
  { name: "AI Factory Webinar", kind: "webinar", offsetDays: -30, location: "Virtual" },
  {
    name: "Manufacturing Tech Forum",
    kind: "conference",
    offsetDays: -45,
    location: "Detroit, MI",
  },
  {
    name: "Financial Services Infrastructure Summit",
    kind: "conference",
    offsetDays: 75,
    location: "New York, NY",
  },
  { name: "GPU Capacity Planning Workshop", kind: "briefing", offsetDays: 22, location: "Virtual" },
  {
    name: "Year-End Executive Roundtable",
    kind: "roundtable",
    offsetDays: 88,
    location: "Phoenix, AZ",
  },
  { name: "Cloud Cost Clinic", kind: "webinar", offsetDays: -60, location: "Virtual" },
  { name: "Partner Innovation Day", kind: "partner", offsetDays: 15, location: "Raleigh, NC" },
];

export const PLAN_TEMPLATES = {
  objectives: [
    "Establish executive sponsorship with the CIO and CFO",
    "Become the strategic partner for AI infrastructure",
    "Expand from infrastructure into security and ESM",
    "Win the data center consolidation program",
    "Grow annual bookings 30% year over year",
  ],
  strategies: [
    "Run an AI readiness workshop with the platform team",
    "Lead with a consolidation TCO model for finance",
    "Leverage partner co-sell for the refresh cycle",
    "Introduce the integration facility to operations leadership",
    "Map and engage the full buying committee",
  ],
  actions: [
    "Book executive briefing",
    "Deliver TCO model draft",
    "Schedule facility tour",
    "Identify Economic Buyer for security program",
    "Prepare QBR deck",
    "Introduce managed services lead",
  ],
};
