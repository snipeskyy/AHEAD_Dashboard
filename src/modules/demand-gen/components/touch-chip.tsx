"use client";
import { useDraggable } from "@dnd-kit/core";
import {
  CalendarCheck,
  Check,
  Mail,
  MessageSquare,
  Mic,
  Phone,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Touch } from "../hooks/use-demand-gen";

export const CHANNEL_ICON: Record<string, LucideIcon> = {
  email: Mail,
  linkedin: MessageSquare,
  call: Phone,
  meeting: CalendarCheck,
  event: Presentation,
  briefing: Mic,
};

export function TouchChip({
  t,
  onOpen,
  compact = false,
  now,
}: {
  t: Touch;
  onOpen: (t: Touch) => void;
  compact?: boolean;
  now: number;
}) {
  const done = !!t.completedAt;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: t.id,
    disabled: done,
  });
  const Icon = CHANNEL_ICON[t.channel] ?? Mail;
  const overdue = !done && new Date(t.scheduledAt).getTime() < now;
  const label = `${t.channel} to ${t.persona} at ${t.account.name}${done ? `, completed (${t.outcome ?? ""})` : overdue ? ", overdue" : ", planned"}`;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={label}
      title={`${t.account.name} — ${t.persona}${t.angle ? `\n${t.angle}` : ""}`}
      onClick={() => onOpen(t)}
      data-testid={`touch-${t.id}`}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors",
        done
          ? "bg-muted text-muted-foreground border-transparent"
          : "bg-card hover:border-primary/50 shadow-xs",
        overdue && "border-warning/70 bg-warning/10",
        !done && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        compact && "w-6 justify-center px-0",
      )}
    >
      {done ? (
        <Check className="size-3 shrink-0" aria-hidden />
      ) : (
        <Icon className="size-3 shrink-0" aria-hidden />
      )}
      {!compact && <span className="truncate">{t.account.name}</span>}
    </button>
  );
}
