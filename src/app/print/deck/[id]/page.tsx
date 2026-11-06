import { notFound } from "next/navigation";
import { deckFooter, SlideView } from "@/components/deck/slide-view";
import { readSnapshot } from "@/lib/server/exports";

export const dynamic = "force-dynamic";

/** Print-only route for deck PDFs: one 16:9 page per slide, rendered from the saved snapshot. */
export default async function PrintDeck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = await readSnapshot(id).catch(() => null);
  if (!snap?.deck) notFound();
  const { slides, theme } = snap.deck;
  const footer = deckFooter(snap, theme);
  return (
    <main className="bg-white" data-print-ready="true">
      <style>{`@page { size: 13.333in 7.5in; margin: 0; } html, body { background: #fff !important; margin: 0; } .deck-page { width: 13.333in; height: 7.5in; overflow: hidden; break-after: page; } .deck-page:last-child { break-after: auto; }`}</style>
      {slides.map((s, i) => (
        <div key={s.id} className="deck-page">
          {/* 1280px canvas → 13.333in at 96dpi */}
          <SlideView slide={s} theme={theme} footer={footer} index={i} total={slides.length} />
        </div>
      ))}
    </main>
  );
}
