"use client";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { useModuleSettings } from "@/hooks/use-module-settings";
import { planningWindow } from "@/lib/daily/fiscal";

/** "Budget planning likely starts in ~N weeks" from the fiscal year end (an estimate, labeled as such). */
export function BudgetTiming({ fye }: { fye: string | null | undefined }) {
  const s = useModuleSettings<{ planningStartMonths: number; planningEndMonths: number }>("territory");
  const [now] = useState(() => new Date());
  const w = planningWindow(fye, now, { startMonthsBefore: s.planningStartMonths ?? 5, endMonthsBefore: s.planningEndMonths ?? 2 });
  if (!w) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${w.phase === "in-window" ? "text-warning-text" : ""}`} title="Estimated from the fiscal year end">
      <CalendarClock className="size-3" aria-hidden /> {w.label}
    </span>
  );
}
