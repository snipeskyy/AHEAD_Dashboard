"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, FileText, KanbanSquare, Lightbulb, Send, Star } from "lucide-react";
import Link from "next/link";
import { NotesList } from "@/components/notes-list";
import { CardSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { practiceLabel } from "@/config/practice-areas";
import { SIGNAL_TYPE_LABELS, type SignalType } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";
import { useSignal, type SignalRow } from "../hooks/use-signals";
import type { SignalAction } from "./signal-row";

export function SignalDetailSheet({
  id,
  onClose,
  onAction,
}: {
  id: string | null;
  onClose: () => void;
  onAction: (a: SignalAction, s: SignalRow) => void;
}) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {id && <Detail id={id} onAction={onAction} />}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  id,
  onAction,
}: {
  id: string;
  onAction: (a: SignalAction, s: SignalRow) => void;
}) {
  const { data: s, isLoading } = useSignal(id);
  if (isLoading || !s)
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Loading signal</SheetTitle>
        <CardSkeleton lines={6} />
      </div>
    );
  const rb = s.relevanceBreakdown;
  return (
    <>
      <SheetHeader className="border-b p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-normal">
            {SIGNAL_TYPE_LABELS[s.type as SignalType] ?? s.type}
          </Badge>
          {s.practiceTags.map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {practiceLabel(t, true)}
            </Badge>
          ))}
          {s.isDemo && (
            <Badge variant="outline" className="text-muted-foreground font-normal">
              Demo data
            </Badge>
          )}
        </div>
        <SheetTitle className="text-base leading-snug">{s.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Link
              href={`/accounts/${s.accountId}`}
              className="text-foreground font-medium hover:underline"
            >
              {s.accountName}
            </Link>
            <span>·</span>
            <span>{formatDistanceToNowStrict(new Date(s.publishedAt), { addSuffix: true })}</span>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                Open source <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-5 p-5">
        {s.summary && <p className="text-[13px]">{s.summary}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onAction("star", s)}>
            <Star className={cn(s.starred && "fill-warning text-warning")} />{" "}
            {s.starred ? "Starred" : "Star"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("summary", s)}>
            <FileText /> {s.inNextSummary ? "In next summary" : "Add to summary"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("play", s)}>
            <Lightbulb /> Play
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("touch", s)}>
            <Send /> Touch
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction("opportunity", s)}>
            <KanbanSquare /> Opportunity
          </Button>
        </div>
        {(s.convertedTouches > 0 || s.convertedOpps.length > 0) && (
          <p className="text-muted-foreground text-xs">
            Converted: {s.convertedTouches} touch{s.convertedTouches === 1 ? "" : "es"}
            {s.convertedOpps.map((o) => (
              <span key={o.id}>
                {" "}
                ·{" "}
                <Link
                  href={`/opportunities?focus=${o.id}`}
                  className="text-primary hover:underline"
                >
                  {o.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        <section data-internal-only="true">
          <h3 className="mb-2 text-sm font-semibold">
            Why this relevance ({Math.round(s.relevance)})
          </h3>
          <table className="w-full text-[13px]">
            <caption className="sr-only">Relevance breakdown</caption>
            <tbody>
              {rb.components.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-1.5">
                    {c.label}
                    <div className="text-muted-foreground text-xs">{c.input}</div>
                  </td>
                  <td className="tabular py-1.5 text-right">× {c.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground mt-1 text-xs">
            {rb.formula}. Current value {Math.round(rb.value)} (stored score is refreshed hourly as
            it ages).
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Practice tagging</h3>
          {s.tagHits.length === 0 ? (
            <p className="text-muted-foreground text-[13px]">
              No tagging rule matched. Edit rules in Settings → Taxonomy & tagging.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {s.tagHits.map((h, i) => (
                <li key={i}>
                  <Badge variant="outline" className="font-normal">
                    “{h.keyword}” → {practiceLabel(h.practiceArea, true)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          <NotesList entityType="signal" entityId={s.id} compact />
        </section>
      </div>
    </>
  );
}
