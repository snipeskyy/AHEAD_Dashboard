export const RECURRENCES = ["weekly", "biweekly", "monthly", "quarterly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

/** Next due date for a recurring task, always after `after` (pure). */
export function nextDue(from: Date, r: Recurrence, after = from): Date {
  let d = new Date(from);
  const step = () => {
    if (r === "weekly") d = new Date(d.getTime() + 7 * 86_400_000);
    else if (r === "biweekly") d = new Date(d.getTime() + 14 * 86_400_000);
    else {
      const x = new Date(d);
      x.setUTCMonth(x.getUTCMonth() + (r === "monthly" ? 1 : 3));
      d = x;
    }
  };
  do step();
  while (d <= after);
  return d;
}
