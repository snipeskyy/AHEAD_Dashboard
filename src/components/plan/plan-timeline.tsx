import { AlertTriangle, CheckCircle2, Circle, CircleDot } from "lucide-react";
import {
  SIDE_LABELS,
  STATUS_LABELS,
  isOverdue,
  mapProgress,
  sortSteps,
  type MapStep,
} from "@/lib/map/model";
import { cn } from "@/lib/utils";

const fmt = (d: string | null) =>
  d
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Date TBD";

function StatusMark({ s, now }: { s: MapStep; now: Date }) {
  const late = isOverdue(s, now);
  const Icon =
    s.status === "done"
      ? CheckCircle2
      : s.status === "at-risk" || late
        ? AlertTriangle
        : s.status === "in-progress"
          ? CircleDot
          : Circle;
  const tone =
    s.status === "done"
      ? "text-good-text"
      : s.status === "at-risk" || late
        ? "text-warning-text"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", tone)}>
      <Icon className="size-3.5" aria-hidden />
      {late && s.status !== "at-risk" ? "Overdue" : STATUS_LABELS[s.status]}
    </span>
  );
}

/**
 * The plan as a dated timeline. Used by the editor preview and the PDF print route. `steps` should already be the
 * customer view for a customer audience (customerSteps()).
 */
export function PlanTimeline({
  title,
  accountName,
  objective,
  targetDate,
  steps,
  now,
  showNotes = false,
}: {
  title: string;
  accountName: string;
  objective: string | null;
  targetDate: string | null;
  steps: Array<MapStep | Omit<MapStep, "note">>;
  now: Date;
  showNotes?: boolean;
}) {
  const full = steps.map((s) => ({ note: "", ...s })) as MapStep[];
  const p = mapProgress(full, targetDate, now);
  return (
    <article className="grid gap-5" aria-label="Mutual action plan">
      <header className="grid gap-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Mutual action plan · {accountName}
        </p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {objective && <p className="text-[13px] leading-relaxed">{objective}</p>}
        <p className="text-muted-foreground text-[13px]">
          Target decision date:{" "}
          <span className="text-foreground font-medium">{fmt(targetDate)}</span> · {p.summary}
        </p>
      </header>
      {full.length === 0 ? (
        <p className="text-muted-foreground text-[13px]">No steps yet.</p>
      ) : (
        <ol className="relative grid gap-0 border-l pl-5">
          {sortSteps(full).map((s) => (
            <li key={s.id} className="relative py-2.5" style={{ breakInside: "avoid" }}>
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 -left-[25px] size-2.5 rounded-full border-2",
                  s.status === "done"
                    ? "border-good-text bg-good-text"
                    : "bg-card border-muted-foreground",
                )}
              />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="tabular w-28 shrink-0 text-xs font-medium">{fmt(s.dueDate)}</span>
                <span className="min-w-0 flex-1 text-[13px] font-medium">{s.title}</span>
                <StatusMark s={s} now={now} />
              </div>
              <p className="text-muted-foreground mt-0.5 pl-0 text-xs sm:pl-[124px]">
                {SIDE_LABELS[s.side]}
                {s.owner ? ` · ${s.owner}` : ""}
              </p>
              {showNotes && s.note && (
                <p
                  className="bg-muted mt-1 rounded px-2 py-1 text-xs sm:ml-[124px]"
                  data-internal-only="true"
                >
                  Internal note: {s.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
