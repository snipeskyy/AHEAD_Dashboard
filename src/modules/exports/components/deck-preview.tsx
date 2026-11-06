"use client";
import { Eye, EyeOff, MessageSquareText, Play, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { deckFooter, SlideView } from "@/components/deck/slide-view";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { DeckTheme, Slide } from "@/lib/deck/types";
import type { ExportConfig } from "@/lib/export/config";
import type { ExportDocument } from "@/lib/export/types";
import { cn } from "@/lib/utils";
import { DeckPresenter } from "./deck-presenter";

/**
 * What the audience will actually see: redaction-preview marks are removed, not outlined, and slides
 * left with no content are dropped. The thumbnails keep the marks so you can review them.
 */
export function audienceSlides(slides: Slide[]): Slide[] {
  const always = new Set(["title", "agenda", "divider", "closing"]);
  return slides
    .map((s) => ({
      ...s,
      redacted: false,
      blocks: s.blocks
        .filter((b) => !b.redacted)
        .map((b) =>
          b.kind === "kv" || b.kind === "list"
            ? ({ ...b, items: b.items.filter((i) => !i.redacted) } as typeof b)
            : b.kind === "table"
              ? { ...b, columns: b.columns.filter((c) => !c.redacted) }
              : b,
        )
        .filter((b) => !((b.kind === "kv" || b.kind === "list") && !b.items.length)),
    }))
    .filter((s) => always.has(s.layout) || s.blocks.length > 0);
}

export type DeckDoc = ExportDocument & { deck: { slides: Slide[]; theme: DeckTheme } };
const THUMB = 0.25;

/** Slide thumbnails: hide/show each slide, edit speaker notes, see redactions, and present. */
export function DeckPreview({ doc, config, onChange }: { doc: DeckDoc; config: ExportConfig; onChange: (c: ExportConfig) => void }) {
  const [presenting, setPresenting] = useState<number | null>(null);
  const { slides, theme } = doc.deck;
  const visible = slides.filter((s) => !s.hidden);
  const footer = deckFooter(doc, theme);
  const redacted = slides.filter((s) => s.redacted && !s.hidden).length;
  const toggle = (id: string) => {
    const h = config.deck.hiddenSlides;
    onChange({ ...config, deck: { ...config.deck, hiddenSlides: h.includes(id) ? h.filter((x) => x !== id) : [...h, id] } });
  };
  const setNote = (id: string, text: string) => onChange({ ...config, deck: { ...config.deck, notes: { ...config.deck.notes, [id]: text } } });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-medium">{visible.length} slides</span>
        <span className="text-muted-foreground">· {slides.length - visible.length} hidden · theme: {theme.name}</span>
        {redacted > 0 && (
          <span className="text-warning-text inline-flex items-center gap-1 text-xs" role="status">
            <TriangleAlert className="size-3.5" aria-hidden /> {redacted} slide{redacted === 1 ? "" : "s"} include content removed for this audience
          </span>
        )}
        <Button size="sm" className="ml-auto" onClick={() => setPresenting(0)} disabled={!visible.length}>
          <Play /> Present
        </Button>
      </div>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3" aria-label="Slides">
        {slides.map((s) => {
          const i = visible.findIndex((v) => v.id === s.id);
          return (
            <li key={s.id} className={cn("bg-card grid gap-1.5 rounded-md border p-2", s.hidden && "opacity-45")}>
              <div className="overflow-hidden rounded border">
                <SlideView slide={s} theme={theme} footer={footer} index={Math.max(0, i)} total={visible.length} scale={THUMB} />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground tabular w-6">{s.hidden ? "—" : i + 1}</span>
                <span className="min-w-0 flex-1 truncate" title={s.title}>{s.title}</span>
                <span className="text-muted-foreground hidden sm:inline">{s.layout}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Present from slide: ${s.title}`} disabled={s.hidden} onClick={() => setPresenting(i)}><Play /></Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={`Speaker notes: ${s.title}`}><MessageSquareText /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <label className="grid gap-1.5 text-xs">
                      Speaker notes
                      <Textarea rows={5} defaultValue={s.notes} onBlur={(e) => e.target.value !== s.notes && setNote(s.id, e.target.value)} />
                    </label>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon-xs" aria-label={`${s.hidden ? "Show" : "Hide"} slide: ${s.title}`} onClick={() => toggle(s.id)}>
                  {s.hidden ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {presenting !== null && <DeckPresenter slides={audienceSlides(visible)} theme={theme} footer={footer} start={presenting} onClose={() => setPresenting(null)} />}
    </div>
  );
}
