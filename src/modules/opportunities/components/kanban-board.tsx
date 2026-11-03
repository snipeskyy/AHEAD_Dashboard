"use client";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { memo, useMemo, useState } from "react";
import { practiceLabel } from "@/config/practice-areas";
import { OPEN_STAGES, STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { formatCurrencyCompact } from "@/lib/format";
import type { OppRow } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";
import { useUpdateOpportunity } from "../hooks/use-opportunities";
import { MeddpiccMeter, RiskBadge } from "./badges";

const COLUMNS: Stage[] = [...OPEN_STAGES, "ClosedWon", "ClosedLost"];
const CLOSED_WINDOW_DAYS = 90;

export function KanbanBoard({ rows, onOpen }: { rows: OppRow[]; onOpen: (id: string) => void }) {
  const update = useUpdateOpportunity();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [now] = useState(() => Date.now());

  const byStage = useMemo(() => {
    const m = new Map<Stage, OppRow[]>(COLUMNS.map((s) => [s, []]));
    for (const r of rows) {
      if (
        (r.stage === "ClosedWon" || r.stage === "ClosedLost") &&
        r.closedAt &&
        now - new Date(r.closedAt).getTime() > CLOSED_WINDOW_DAYS * 86_400_000
      )
        continue;
      m.get(r.stage)?.push(r);
    }
    for (const list of m.values()) list.sort((a, b) => b.amount - a.amount);
    return m;
  }, [rows, now]);

  const active = activeId ? rows.find((r) => r.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const to = e.over?.id as Stage | undefined;
    const opp = rows.find((r) => r.id === e.active.id);
    if (!to || !opp || opp.stage === to) return;
    update.mutate({ id: opp.id, patch: { stage: to } });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${rows.find((r) => r.id === active.id)?.name ?? "opportunity"}.`,
          onDragOver: ({ over }) =>
            over ? `Over ${STAGE_LABELS[over.id as Stage]}.` : "Not over a stage.",
          onDragEnd: ({ over }) =>
            over ? `Moved to ${STAGE_LABELS[over.id as Stage]}.` : "Move cancelled.",
          onDragCancel: () => "Move cancelled.",
        },
      }}
    >
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ height: "calc(100svh - 270px)", minHeight: 420 }}
      >
        {COLUMNS.map((stage) => (
          <Column key={stage} stage={stage} rows={byStage.get(stage) ?? []} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <CardBody row={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  rows,
  onOpen,
}: {
  stage: Stage;
  rows: OppRow[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const closed = stage === "ClosedWon" || stage === "ClosedLost";
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[stage]} — ${rows.length} opportunities`}
      data-testid={`kanban-col-${stage}`}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border transition-colors",
        isOver && "border-primary/60 bg-brand-soft",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 border-b px-3 py-2.5">
        <h2 className="text-[13px] font-semibold">
          {STAGE_LABELS[stage]}{" "}
          <span className="text-muted-foreground tabular ml-1 font-normal">{rows.length}</span>
        </h2>
        <span className="text-muted-foreground tabular text-xs" data-internal-only="true">
          {formatCurrencyCompact(total)}
        </span>
      </header>
      {closed && (
        <p className="text-muted-foreground px-3 pt-2 text-[11px]">
          Last {CLOSED_WINDOW_DAYS} days
        </p>
      )}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {rows.map((r) => (
          <DraggableCard key={r.id} row={r} onOpen={onOpen} />
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">Drop deals here</p>
        )}
      </div>
    </section>
  );
}

const DraggableCard = memo(function DraggableCard({
  row,
  onOpen,
}: {
  row: OppRow;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={`opp-card-${row.id}`}
      aria-roledescription="Draggable opportunity"
      aria-label={`${row.name}, ${row.accountName}. Press space to move between stages, Enter to open.`}
      onClick={() => onOpen(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(row.id);
        listeners?.onKeyDown?.(e);
      }}
      className={cn(
        "focus-visible:ring-ring rounded-md outline-none focus-visible:ring-2",
        isDragging && "opacity-40",
      )}
    >
      <CardBody row={row} />
    </div>
  );
});

function CardBody({ row, dragging }: { row: OppRow; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "bg-card cursor-grab rounded-md border p-3 shadow-xs transition-shadow hover:shadow-sm",
        dragging && "rotate-1 cursor-grabbing shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{row.name}</div>
          <div className="text-muted-foreground truncate text-xs">{row.accountName}</div>
        </div>
        <RiskBadge flags={row.riskFlags} compact />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="tabular font-medium" data-internal-only="true">
          {formatCurrencyCompact(row.amount)}
        </span>
        <span className="text-muted-foreground">{format(new Date(row.closeDate), "MMM d")}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="bg-muted text-muted-foreground truncate rounded px-1.5 py-0.5 text-[11px]">
          {practiceLabel(row.practiceArea, true)}
        </span>
        <span data-internal-only="true">
          <MeddpiccMeter score={row.meddpiccScore} />
        </span>
      </div>
    </div>
  );
}
