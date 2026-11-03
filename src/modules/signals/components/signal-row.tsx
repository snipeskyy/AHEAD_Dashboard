"use client";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Archive,
  Check,
  ExternalLink,
  FileText,
  KanbanSquare,
  Lightbulb,
  MoreHorizontal,
  NotebookPen,
  Send,
  Star,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { practiceLabel } from "@/config/practice-areas";
import { SOURCE_CATALOG } from "@/lib/adapters/catalog";
import { SIGNAL_TYPE_LABELS, type SignalType } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";
import type { SignalRow } from "../hooks/use-signals";
import { RelevanceBadge } from "./relevance-badge";

export type SignalAction =
  "open" | "star" | "read" | "dismiss" | "summary" | "note" | "touch" | "play" | "opportunity";
const sourceLabel = (id: string) => SOURCE_CATALOG.find((s) => s.id === id)?.label ?? id;

export const SignalRowView = memo(function SignalRowView({
  s,
  onAction,
  active,
}: {
  s: SignalRow;
  onAction: (a: SignalAction, s: SignalRow) => void;
  active?: boolean;
}) {
  return (
    <article
      aria-label={s.title}
      data-testid={`signal-${s.id}`}
      className={cn(
        "group hover:bg-muted/40 flex gap-3 border-b px-4 py-3 transition-colors",
        active && "bg-brand-soft/60",
        s.dismissed && "opacity-60",
      )}
    >
      <RelevanceBadge value={s.relevance} parts={s.relevanceParts} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {!s.read && (
            <span
              className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
              aria-label="Unread"
            />
          )}
          <button
            type="button"
            onClick={() => onAction("open", s)}
            className={cn(
              "text-left text-[13px] leading-snug hover:underline",
              !s.read ? "font-semibold" : "font-medium",
            )}
          >
            {s.title}
          </button>
        </div>
        {s.summary && (
          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{s.summary}</p>
        )}
        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <Link
            href={`/accounts/${s.accountId}?tab=signals`}
            className="text-foreground font-medium hover:underline"
          >
            {s.accountName}
          </Link>
          <span aria-hidden>·</span>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
            {SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type}
          </Badge>
          {s.practiceTags.map((t) => (
            <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
              {practiceLabel(t, true)}
            </Badge>
          ))}
          <span>{s.isDemo ? "Demo data" : sourceLabel(s.source)}</span>
          <span aria-hidden>·</span>
          <time dateTime={s.publishedAt}>
            {formatDistanceToNowStrict(new Date(s.publishedAt), { addSuffix: true })}
          </time>
          {s.inNextSummary && (
            <Badge
              variant="outline"
              className="border-primary/40 text-primary h-4 gap-1 px-1.5 text-[10px] font-normal"
            >
              <FileText className="size-2.5" /> In summary
            </Badge>
          )}
          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              Source <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={s.starred ? "Unstar" : "Star"}
          aria-pressed={s.starred}
          onClick={() => onAction("star", s)}
        >
          <Star className={cn(s.starred && "fill-warning text-warning")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={s.dismissed ? "Restore" : "Dismiss"}
          onClick={() => onAction("dismiss", s)}
        >
          <Archive />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => onAction("read", s)}>
              <Check /> Mark as {s.read ? "unread" : "read"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("note", s)}>
              <NotebookPen /> Add note
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("summary", s)}>
              <FileText />{" "}
              {s.inNextSummary ? "Remove from next summary" : "Add to next exec summary"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAction("play", s)}>
              <Lightbulb /> Convert to play…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("touch", s)}>
              <Send /> Convert to touch…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("opportunity", s)}>
              <KanbanSquare /> Convert to opportunity…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
});
