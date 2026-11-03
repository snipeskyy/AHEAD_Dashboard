"use client";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCENT_IDS, ACCENTS, themeConfig } from "@/config/theme";
import { useMounted } from "@/hooks/use-mounted";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { applyAccent } from "@/lib/client/dom";
import { cn } from "@/lib/utils";
import { SettingsRow, SettingsSection } from "./section";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const { data } = useSetting("appearance");
  const save = useSaveSetting("appearance");
  const appearance = data ?? {
    accent: themeConfig.defaultAccent,
    wordmark: themeConfig.wordmark,
    density: "comfortable" as const,
  };

  const update = (patch: Partial<typeof appearance>) => {
    const next = { ...appearance, ...patch };
    if (patch.accent) applyAccent(patch.accent);
    save.mutate(next, { onError: (e) => toast.error(e.message) });
  };

  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Theme"
        description="Charts and tables are designed for both light and dark."
      >
        <SettingsRow label="Color mode">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mounted ? (theme ?? "system") : ""}
            onValueChange={(v) => v && setTheme(v)}
            aria-label="Color mode"
          >
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system">System</ToggleGroupItem>
          </ToggleGroup>
        </SettingsRow>
        <SettingsRow
          label="Accent color"
          description="Used for primary actions and focus. Chart series colors are fixed for consistency."
        >
          <div role="radiogroup" aria-label="Accent color" className="flex gap-2">
            {ACCENT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={appearance.accent === id}
                aria-label={ACCENTS[id].label}
                onClick={() => update({ accent: id })}
                className={cn(
                  "ring-offset-card grid size-7 place-items-center rounded-full ring-offset-2 transition",
                  appearance.accent === id && "ring-foreground/70 ring-2",
                )}
                style={{ background: ACCENTS[id].swatch }}
              >
                {appearance.accent === id && <Check className="size-3.5 text-white" aria-hidden />}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection
        title="Wordmark"
        description="A neutral placeholder. No third-party logos are used anywhere in the app."
      >
        <WordmarkEditor
          key={appearance.wordmark}
          current={appearance.wordmark}
          onSave={(w) => update({ wordmark: w })}
        />
      </SettingsSection>
    </div>
  );
}

function WordmarkEditor({ current, onSave }: { current: string; onSave: (w: string) => void }) {
  const [wordmark, setWordmark] = useState(current);
  return (
    <SettingsRow
      label="Wordmark text"
      description="Up to 12 characters; the first 3 appear in the badge."
      htmlFor="wordmark"
    >
      <div className="flex gap-2">
        <Input
          id="wordmark"
          className="w-40"
          maxLength={12}
          value={wordmark}
          onChange={(e) => setWordmark(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!wordmark.trim() || wordmark === current}
          onClick={() => onSave(wordmark.trim())}
        >
          Save
        </Button>
      </div>
    </SettingsRow>
  );
}
