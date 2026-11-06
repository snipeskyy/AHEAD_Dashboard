/**
 * Budget timing from a fiscal year end (pure). Planning typically runs from ~`startMonths` before the next
 * fiscal year begins until ~`endMonths` before it. All estimates are labeled "likely".
 */
export interface PlanningConfig {
  startMonthsBefore: number;
  endMonthsBefore: number;
}
export const DEFAULT_PLANNING: PlanningConfig = { startMonthsBefore: 5, endMonthsBefore: 2 };
const DAY = 86_400_000;

/** "0630" → the next fiscal year start (the day after FYE) on or after `now`. */
export function nextFiscalYearStart(fye: string, now: Date): Date | null {
  if (!/^\d{4}$/.test(fye)) return null;
  const m = Number(fye.slice(0, 2)) - 1;
  const d = Number(fye.slice(2));
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  for (const y of [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // clamp e.g. 0229
    const start = new Date(Date.UTC(y, m, Math.min(d, lastDay)) + DAY);
    if (start.getTime() > now.getTime()) return start;
  }
  return null;
}

const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
};

export interface PlanningWindow {
  fiscalYearStart: Date;
  start: Date;
  end: Date;
  phase: "upcoming" | "in-window" | "closing";
  weeksUntilStart: number;
  label: string;
}

export function planningWindow(fye: string | null | undefined, now: Date, cfg: PlanningConfig = DEFAULT_PLANNING): PlanningWindow | null {
  if (!fye) return null;
  let fys = nextFiscalYearStart(fye, now);
  if (!fys) return null;
  let start = addMonths(fys, -cfg.startMonthsBefore);
  let end = addMonths(fys, -cfg.endMonthsBefore);
  // Past this year's window → the decisions are made; look at next year's window.
  if (now > end && now < fys) {
    const phase = "closing" as const;
    return { fiscalYearStart: fys, start, end, phase, weeksUntilStart: 0, label: `Budget likely set; new fiscal year starts ${fmt(fys)}` };
  }
  if (now >= fys) {
    fys = addMonths(fys, 12);
    start = addMonths(fys, -cfg.startMonthsBefore);
    end = addMonths(fys, -cfg.endMonthsBefore);
  }
  const weeks = Math.max(0, Math.round((start.getTime() - now.getTime()) / (7 * DAY)));
  if (now >= start)
    return { fiscalYearStart: fys, start, end, phase: "in-window", weeksUntilStart: 0, label: `Budget planning likely underway (until ~${fmt(end)})` };
  return {
    fiscalYearStart: fys,
    start,
    end,
    phase: "upcoming",
    weeksUntilStart: weeks,
    label: weeks <= 1 ? "Budget planning likely starts this week" : `Budget planning likely starts in ~${weeks} weeks`,
  };
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
