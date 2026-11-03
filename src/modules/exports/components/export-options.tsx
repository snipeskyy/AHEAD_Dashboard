"use client";
import { Building2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ExportConfig } from "@/lib/export/config";

/** Audience, title, watermark, date stamp, version and prepared-by. */
export function ExportOptions({
  config,
  onChange,
}: {
  config: ExportConfig;
  onChange: (c: ExportConfig) => void;
}) {
  const set = <K extends keyof ExportConfig>(k: K, v: ExportConfig[K]) =>
    onChange({ ...config, [k]: v });
  // Keep the default watermark in step with the audience unless the user typed their own.
  const setAudience = (audience: ExportConfig["audience"]) => {
    const wm = config.watermark;
    const watermark =
      audience === "customer" && wm === "INTERNAL ONLY"
        ? ""
        : audience === "internal" && !wm
          ? "INTERNAL ONLY"
          : wm;
    onChange({ ...config, audience, watermark });
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-muted-foreground text-xs">Audience</Label>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={config.audience}
          onValueChange={(v) => v && setAudience(v as ExportConfig["audience"])}
          aria-label="Audience"
        >
          <ToggleGroupItem value="internal" className="gap-1.5">
            <Building2 className="size-3.5" />
            Internal
          </ToggleGroupItem>
          <ToggleGroupItem value="customer" className="gap-1.5">
            <Users className="size-3.5" />
            Customer-facing
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-muted-foreground text-xs">
          {config.audience === "customer"
            ? "Internal fields (probability, competitors, risk, scores, notes) and internal-only sections are removed automatically."
            : "Everything is included. Toggle individual fields per section."}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="exp-title" className="text-muted-foreground text-xs">
          Title
        </Label>
        <Input
          id="exp-title"
          value={config.title}
          maxLength={160}
          onChange={(e) => set("title", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-wm" className="text-muted-foreground text-xs">
            Watermark
          </Label>
          <Input
            id="exp-wm"
            value={config.watermark}
            maxLength={40}
            placeholder="e.g. DRAFT"
            onChange={(e) => set("watermark", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="exp-ver" className="text-muted-foreground text-xs">
            Version
          </Label>
          <Input
            id="exp-ver"
            type="number"
            min={1}
            max={999}
            value={config.version}
            onChange={(e) =>
              set("version", Math.max(1, Math.min(999, Number(e.target.value) || 1)))
            }
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="exp-by" className="text-muted-foreground text-xs">
          Prepared by
        </Label>
        <Input
          id="exp-by"
          value={config.preparedBy}
          maxLength={80}
          placeholder="Your name (optional)"
          onChange={(e) => set("preparedBy", e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="exp-date" className="text-[13px] font-normal">
          Date stamp
        </Label>
        <Switch
          id="exp-date"
          checked={config.dateStamp}
          onCheckedChange={(v) => set("dateStamp", v)}
        />
      </div>
    </div>
  );
}
