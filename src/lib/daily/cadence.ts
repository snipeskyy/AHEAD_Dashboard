/** Touch cadence by tier (pure). */
import type { Tier } from "@/lib/domain/enums";

export type CadenceDays = Record<Tier, number>;
export const DEFAULT_CADENCE: CadenceDays = { Strategic: 14, Growth: 30, Maintain: 60 };
const DAY = 86_400_000;

export interface CadenceState {
  dueAt: Date | null;
  overdueDays: number;
  daysSinceTouch: number | null;
  status: "never" | "overdue" | "due-soon" | "ok";
}

export function cadenceState(tier: Tier, lastTouchAt: Date | null, now: Date, days: CadenceDays = DEFAULT_CADENCE): CadenceState {
  const every = days[tier];
  if (!lastTouchAt) return { dueAt: null, overdueDays: every, daysSinceTouch: null, status: "never" };
  const since = Math.floor((now.getTime() - lastTouchAt.getTime()) / DAY);
  const dueAt = new Date(lastTouchAt.getTime() + every * DAY);
  const overdue = since - every;
  return { dueAt, overdueDays: Math.max(0, overdue), daysSinceTouch: since, status: overdue > 0 ? "overdue" : overdue > -4 ? "due-soon" : "ok" };
}
