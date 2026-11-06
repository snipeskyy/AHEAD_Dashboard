"use client";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SLIDE_H, SLIDE_W, SlideView } from "@/components/deck/slide-view";
import { Button } from "@/components/ui/button";
import type { DeckTheme, Slide } from "@/lib/deck/types";

const subscribe = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const size = () => `${window.innerWidth}x${window.innerHeight}`;

/** Full-screen presenter: ←/→ or space to move, N toggles speaker notes, Esc exits. */
export function DeckPresenter({ slides, theme, footer, start, onClose }: { slides: Slide[]; theme: DeckTheme; footer: string; start: number; onClose: () => void }) {
  const [i, setI] = useState(() => Math.min(start, Math.max(0, slides.length - 1)));
  const [notes, setNotes] = useState(false);
  const [w, h] = useSyncExternalStore(subscribe, size, () => "1280x720").split("x").map(Number);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setI((x) => Math.min(slides.length - 1, x + 1)); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1));
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);
  const s = slides[i];
  const noteH = notes ? 140 : 0;
  const scale = Math.min((w - 32) / SLIDE_W, (h - 72 - noteH) / SLIDE_H);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Presenting slide ${i + 1} of ${slides.length}`} className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-black">
      <SlideView slide={s} theme={theme} footer={footer} index={i} total={slides.length} scale={scale} />
      {notes && (
        <div className="max-h-[130px] w-full max-w-[1100px] overflow-auto rounded bg-neutral-900 px-4 py-2 text-sm text-neutral-100" aria-label="Speaker notes">
          {s.notes || <span className="text-neutral-400">No notes for this slide.</span>}
        </div>
      )}
      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <Button size="icon-sm" variant="ghost" className="text-neutral-200 hover:bg-neutral-800" aria-label="Previous slide" onClick={() => setI(Math.max(0, i - 1))}><ChevronLeft /></Button>
        <span className="tabular" aria-live="polite">{i + 1} / {slides.length}</span>
        <Button size="icon-sm" variant="ghost" className="text-neutral-200 hover:bg-neutral-800" aria-label="Next slide" onClick={() => setI(Math.min(slides.length - 1, i + 1))}><ChevronRight /></Button>
        <Button size="sm" variant="ghost" className="text-neutral-200 hover:bg-neutral-800" aria-pressed={notes} onClick={() => setNotes(!notes)}><StickyNote /> Notes (N)</Button>
        <Button size="sm" variant="ghost" className="text-neutral-200 hover:bg-neutral-800" onClick={onClose}><X /> Exit (Esc)</Button>
      </div>
    </div>,
    document.body,
  );
}
