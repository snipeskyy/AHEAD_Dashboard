import { z } from "zod";

/**
 * Mutual action plan (Phase 14): the dated path both sides agree on to reach a decision for one opportunity.
 * Pure model + helpers. Owners are roles or names the user types (no contact details). Step notes are internal;
 * steps marked not customer-visible never reach the customer view, PDF or customer-audience exports.
 */
export const MAP_SIDES = ["customer", "us", "joint"] as const;
export const MAP_STATUSES = ["planned", "in-progress", "done", "at-risk"] as const;
export const SIDE_LABELS: Record<(typeof MAP_SIDES)[number], string> = {
  customer: "Customer",
  us: "Our team",
  joint: "Joint",
};
export const STATUS_LABELS: Record<(typeof MAP_STATUSES)[number], string> = {
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
  "at-risk": "At risk",
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const MapStepSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(2).max(200),
  side: z.enum(MAP_SIDES).default("joint"),
  owner: z.string().trim().max(80).default(""),
  dueDate: day.nullable().default(null),
  status: z.enum(MAP_STATUSES).default("planned"),
  customerVisible: z.boolean().default(true),
  note: z.string().max(1000).default(""),
});
export const MapStepsSchema = z.array(MapStepSchema).max(60);
export type MapStep = z.infer<typeof MapStepSchema>;

export const MapPatchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  objective: z.string().max(2000).nullable().optional(),
  targetDate: day.nullable().optional(),
  steps: MapStepsSchema.optional(),
});
export type MapPatch = z.infer<typeof MapPatchSchema>;

const DAY = 86_400_000;
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T12:00:00.000Z`);

/**
 * A generic decision path (methodology, not account data). Due dates count back from the target date
 * (or forward from today when there is none).
 */
export const STARTER_STEPS: Array<
  Omit<MapStep, "id" | "dueDate" | "status" | "note"> & { offset: number }
> = [
  {
    title: "Align on goals and success criteria",
    side: "joint",
    owner: "",
    customerVisible: true,
    offset: -70,
  },
  { title: "Discovery workshop", side: "joint", owner: "", customerVisible: true, offset: -60 },
  {
    title: "Technical validation / proof of concept",
    side: "us",
    owner: "Solutions architect",
    customerVisible: true,
    offset: -42,
  },
  { title: "Business case review", side: "joint", owner: "", customerVisible: true, offset: -30 },
  {
    title: "Security and architecture review",
    side: "customer",
    owner: "Security team",
    customerVisible: true,
    offset: -24,
  },
  {
    title: "Proposal and commercial review",
    side: "us",
    owner: "",
    customerVisible: true,
    offset: -18,
  },
  {
    title: "Procurement and legal",
    side: "customer",
    owner: "Procurement",
    customerVisible: true,
    offset: -10,
  },
  {
    title: "Executive sign-off",
    side: "customer",
    owner: "Economic buyer",
    customerVisible: true,
    offset: -3,
  },
  { title: "Kickoff", side: "joint", owner: "", customerVisible: true, offset: 7 },
];

export function starterSteps(targetDate: string | null, now: Date, newId: () => string): MapStep[] {
  const anchor = targetDate ? parse(targetDate) : new Date(now.getTime() + 80 * DAY);
  return STARTER_STEPS.map(({ offset, ...s }) => ({
    ...s,
    id: newId(),
    dueDate: toDay(new Date(anchor.getTime() + offset * DAY)),
    status: "planned" as const,
    note: "",
  }));
}

/** Steps in date order (undated last, then original order). */
export const sortSteps = (steps: MapStep[]) =>
  steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.dueDate ?? "9999").localeCompare(b.s.dueDate ?? "9999") || a.i - b.i)
    .map((x) => x.s);

export const isOverdue = (s: MapStep, now: Date) =>
  s.status !== "done" && !!s.dueDate && s.dueDate < toDay(now);

export interface MapProgress {
  total: number;
  done: number;
  overdue: number;
  atRisk: number;
  next: MapStep | null;
  /** Days from today to the target date (negative when past); null without a target. */
  daysToTarget: number | null;
  /** Any open step due after the target date. */
  slipsPastTarget: boolean;
  health: "on-track" | "watch" | "off-track" | "empty";
  /** One sentence, computed from the steps. */
  summary: string;
}

export function mapProgress(steps: MapStep[], targetDate: string | null, now: Date): MapProgress {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "done").length;
  const overdue = steps.filter((s) => isOverdue(s, now)).length;
  const atRisk = steps.filter((s) => s.status === "at-risk").length;
  const next = sortSteps(steps).find((s) => s.status !== "done") ?? null;
  const daysToTarget = targetDate
    ? Math.round((parse(targetDate).getTime() - parse(toDay(now)).getTime()) / DAY)
    : null;
  const slipsPastTarget =
    !!targetDate &&
    steps.some(
      (s) =>
        s.status !== "done" && s.dueDate && s.dueDate > targetDate && !/kickoff/i.test(s.title),
    );
  const health: MapProgress["health"] = !total
    ? "empty"
    : overdue >= 2 || (overdue >= 1 && atRisk >= 1) || slipsPastTarget
      ? "off-track"
      : overdue || atRisk
        ? "watch"
        : "on-track";
  const bits = [`${done} of ${total} steps done`];
  if (overdue) bits.push(`${overdue} overdue`);
  if (atRisk) bits.push(`${atRisk} at risk`);
  if (slipsPastTarget) bits.push("an open step is due after the target date");
  if (daysToTarget !== null)
    bits.push(
      daysToTarget >= 0
        ? `${daysToTarget} days to the target date`
        : `target date passed ${-daysToTarget} days ago`,
    );
  return {
    total,
    done,
    overdue,
    atRisk,
    next,
    daysToTarget,
    slipsPastTarget,
    health,
    summary: total ? `${bits.join(", ")}.` : "No steps yet.",
  };
}

/** What the customer sees: visible steps only, without internal notes. */
export const customerSteps = (steps: MapStep[]) =>
  sortSteps(steps.filter((s) => s.customerVisible)).map(({ note: _n, ...s }) => s);
