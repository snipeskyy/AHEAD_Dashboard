"use client";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterChip } from "@/components/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TOUCH_CHANNELS } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";
import { useTouchesInRange, useTouchPatch, type Touch } from "../hooks/use-demand-gen";
import { CampaignList } from "./campaign-list";
import { TouchChip } from "./touch-chip";
import { TouchDialog } from "./touch-dialog";

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Calendar + timeline of touches; drag a planned touch to another day to reschedule. */
export function CampaignPlanner() {
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [anchor, setAnchor] = useState(() => new Date());
  const [channels, setChannels] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(["planned", "completed"]);
  const [open, setOpen] = useState<Touch | null>(null);
  const [now] = useState(() => Date.now());

  const range = useMemo(() => {
    if (view === "calendar")
      return {
        from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
        to: addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1),
      };
    const from = startOfWeek(anchor, { weekStartsOn: 1 });
    return { from, to: addDays(from, 35) };
  }, [anchor, view]);
  const { data, isLoading } = useTouchesInRange(range.from, range.to);
  const patch = useTouchPatch();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const touches = useMemo(
    () =>
      (data ?? []).filter(
        (t) =>
          (!channels.length || channels.includes(t.channel)) &&
          status.includes(t.completedAt ? "completed" : "planned"),
      ),
    [data, channels, status],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Touch[]>();
    for (const t of touches) {
      const k = dayKey(new Date(t.scheduledAt));
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [touches]);

  const onDragEnd = (e: DragEndEvent) => {
    const t = touches.find((x) => x.id === e.active.id);
    const target = e.over?.id ? String(e.over.id).split("|").at(-1)! : null;
    if (!t || !target || dayKey(new Date(t.scheduledAt)) === target) return;
    patch.mutate({ id: t.id, patch: { scheduledAt: `${target}${t.scheduledAt.slice(10)}` } });
  };

  const step = (dir: 1 | -1) =>
    setAnchor((a) => (view === "calendar" ? addMonths(a, dir) : addDays(a, dir * 28)));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={view}
          onValueChange={(v) => v && setView(v as typeof view)}
          aria-label="Planner view"
        >
          <ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
          <ToggleGroupItem value="timeline">Timeline</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <span className="ml-1 text-sm font-semibold">
            {view === "calendar"
              ? format(anchor, "MMMM yyyy")
              : `${format(range.from, "MMM d")} – ${format(addDays(range.to, -1), "MMM d")}`}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <FilterChip
            label="Channel"
            options={TOUCH_CHANNELS.map((c) => ({ value: c, label: c }))}
            value={channels}
            onChange={setChannels}
          />
          <FilterChip
            label="Status"
            options={[
              { value: "planned", label: "Planned" },
              { value: "completed", label: "Completed" },
            ]}
            value={status}
            onChange={(v) => setStatus(v.length ? v : ["planned"])}
          />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-[560px]" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {view === "calendar" ? (
            <MonthGrid
              anchor={anchor}
              from={range.from}
              to={range.to}
              byDay={byDay}
              onOpen={setOpen}
              now={now}
            />
          ) : (
            <Timeline from={range.from} touches={touches} onOpen={setOpen} now={now} />
          )}
        </DndContext>
      )}
      <p className="text-muted-foreground text-xs">
        Drag a planned touch to another day to reschedule. Overdue planned touches are highlighted.
        Click a touch to log its outcome.
      </p>
      <CampaignList />
      <TouchDialog touch={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function DayCell({
  id,
  children,
  className,
  label,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      className={cn(className, isOver && "bg-brand-soft ring-primary/40 ring-1 ring-inset")}
    >
      {children}
    </div>
  );
}

function MonthGrid({
  anchor,
  from,
  to,
  byDay,
  onOpen,
  now,
}: {
  anchor: Date;
  from: Date;
  to: Date;
  byDay: Map<string, Touch[]>;
  onOpen: (t: Touch) => void;
  now: number;
}) {
  const days = eachDayOfInterval({ start: from, end: addDays(to, -1) });
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div
      role="grid"
      aria-label="Touch calendar"
      className="bg-card overflow-hidden rounded-lg border"
    >
      <div
        role="row"
        className="bg-muted/40 text-muted-foreground grid grid-cols-7 border-b text-center text-[11px] font-medium"
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} role="columnheader" className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const show = expanded === k ? list : list.slice(0, 4);
          return (
            <DayCell
              key={k}
              id={`day|${k}`}
              label={`${format(d, "EEEE MMMM d")}: ${list.length} touches`}
              className={cn(
                "min-h-28 border-r border-b p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(d, anchor) && "bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center justify-between px-0.5 text-[11px]",
                  isToday(d) ? "text-primary font-semibold" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    isToday(d) &&
                      "bg-primary text-primary-foreground grid size-5 place-items-center rounded-full",
                  )}
                >
                  {format(d, "d")}
                </span>
                {list.length > 0 && <span className="tabular">{list.length}</span>}
              </div>
              <div className="grid gap-0.5">
                {show.map((t) => (
                  <TouchChip key={t.id} t={t} onOpen={onOpen} now={now} />
                ))}
                {list.length > 4 && (
                  <button
                    type="button"
                    className="text-primary text-left text-[11px] hover:underline"
                    onClick={() => setExpanded(expanded === k ? null : k)}
                  >
                    {expanded === k ? "Show less" : `+${list.length - 4} more`}
                  </button>
                )}
              </div>
            </DayCell>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({
  from,
  touches,
  onOpen,
  now,
}: {
  from: Date;
  touches: Touch[];
  onOpen: (t: Touch) => void;
  now: number;
}) {
  const days = Array.from({ length: 35 }, (_, i) => addDays(from, i));
  const rows = useMemo(() => {
    const m = new Map<string, { name: string; tier: string; byDay: Map<string, Touch[]> }>();
    for (const t of touches) {
      const r = m.get(t.accountId) ?? {
        name: t.account.name,
        tier: t.account.tier,
        byDay: new Map(),
      };
      const k = dayKey(new Date(t.scheduledAt));
      r.byDay.set(k, [...(r.byDay.get(k) ?? []), t]);
      m.set(t.accountId, r);
    }
    const order: Record<string, number> = { Strategic: 0, Growth: 1, Maintain: 2 };
    return [...m.entries()].sort(
      (a, b) => order[a[1].tier] - order[b[1].tier] || a[1].name.localeCompare(b[1].name),
    );
  }, [touches]);
  return (
    <div className="bg-card overflow-auto rounded-lg border" style={{ maxHeight: 620 }}>
      <div
        role="grid"
        aria-label="Touch timeline by account"
        className="grid min-w-max"
        style={{ gridTemplateColumns: `220px repeat(${days.length}, 30px)` }}
      >
        <div className="bg-card text-muted-foreground sticky top-0 left-0 z-20 border-r border-b px-3 py-1.5 text-[11px] font-medium">
          Account
        </div>
        {days.map((d) => (
          <div
            key={dayKey(d)}
            className={cn(
              "bg-card text-muted-foreground sticky top-0 z-10 border-b py-1.5 text-center text-[10px]",
              d.getDay() === 1 && "border-l",
              isToday(d) && "text-primary font-semibold",
            )}
          >
            {format(d, "d")}
            {d.getDay() === 1 && <div className="text-[9px]">{format(d, "MMM")}</div>}
          </div>
        ))}
        {rows.map(([accountId, r]) => (
          <div key={accountId} role="row" className="contents">
            <div
              className="bg-card sticky left-0 z-10 truncate border-r border-b px-3 py-1 text-[12px]"
              title={r.name}
            >
              {r.name}
            </div>
            {days.map((d) => {
              const k = dayKey(d);
              const list = r.byDay.get(k) ?? [];
              return (
                <DayCell
                  key={k}
                  id={`${accountId}|${k}`}
                  label={`${r.name} ${format(d, "MMM d")}: ${list.length} touches`}
                  className={cn(
                    "flex flex-col items-center gap-0.5 border-b py-0.5",
                    d.getDay() === 1 && "border-l",
                    (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/30",
                  )}
                >
                  {list.map((t) => (
                    <TouchChip key={t.id} t={t} onOpen={onOpen} compact now={now} />
                  ))}
                </DayCell>
              );
            })}
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="text-muted-foreground p-6 text-center text-sm">No touches in this window.</p>
      )}
    </div>
  );
}
