"use client";
import { FileText, Presentation } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBrand } from "@/components/providers/brand-provider";
import type { ExportConfig } from "@/lib/export/config";

/** Document vs slide deck, brand vs neutral theme, and deck structure (agenda, dividers, closing). */
export function DeckOptions({ config, onChange }: { config: ExportConfig; onChange: (c: ExportConfig) => void }) {
  const brand = useBrand();
  const hasBrand = !!brand && (brand.hasColors || brand.assets.includes("logo"));
  const setDeck = (k: "agenda" | "dividers" | "closing", v: boolean) => onChange({ ...config, deck: { ...config.deck, [k]: v } });
  return (
    <div className="grid gap-3 text-[13px]">
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs">Format style (PowerPoint is always slides)</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={config.style} onValueChange={(v) => v && onChange({ ...config, style: v as ExportConfig["style"] })} aria-label="Format style" className="w-fit">
          <ToggleGroupItem value="document" aria-label="Document"><FileText /> Document</ToggleGroupItem>
          <ToggleGroupItem value="deck" aria-label="Slide deck"><Presentation /> Slide deck</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5">
        <span className="text-muted-foreground text-xs">Theme</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={config.theme} onValueChange={(v) => v && onChange({ ...config, theme: v as ExportConfig["theme"] })} aria-label="Theme" className="w-fit">
          <ToggleGroupItem value="brand" aria-label="Brand">Brand</ToggleGroupItem>
          <ToggleGroupItem value="neutral" aria-label="Neutral">Neutral</ToggleGroupItem>
        </ToggleGroup>
        {config.theme === "brand" && !hasBrand && <span className="text-muted-foreground text-xs">No brand pack installed, so the neutral theme is used (see brand/README.md).</span>}
      </div>
      {config.style === "deck" && (
        <div className="grid gap-2">
          {([["agenda", "Agenda slide"], ["dividers", "Section divider slides"], ["closing", "Closing slide (next steps)"]] as const).map(([k, l]) => (
            <div key={k} className="flex items-center gap-2">
              <Switch id={`deck-${k}`} checked={config.deck[k]} onCheckedChange={(v) => setDeck(k, v)} />
              <Label htmlFor={`deck-${k}`} className="font-normal">{l}</Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
