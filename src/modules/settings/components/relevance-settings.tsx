"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { SOURCE_CATALOG } from "@/lib/adapters/catalog";
import { api } from "@/lib/api-client";
import { DEFAULT_RELEVANCE_CONFIG, type RelevanceConfig } from "@/lib/scoring/relevance";
import { SettingsRow, SettingsSection } from "./section";

export function RelevanceSettings() {
  const { data } = useSetting("scoring.relevance");
  return data ? <Editor key={JSON.stringify(data)} saved={data} /> : null;
}

function Editor({ saved }: { saved: RelevanceConfig }) {
  const save = useSaveSetting("scoring.relevance");
  const [cfg, setCfg] = useState(saved);
  const rescore = useMutation({
    mutationFn: () => api("/api/jobs", { method: "POST", json: { kind: "retag-signals" } }),
  });
  const num = (v: string) => Math.max(0, Math.min(1, Number(v)));
  return (
    <SettingsSection
      title="Signal relevance"
      description="Relevance = 100 × recency (half-life) × source weight × practice match × tier factor."
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCfg(DEFAULT_RELEVANCE_CONFIG)}>
            Reset
          </Button>
          <Button
            size="sm"
            disabled={JSON.stringify(cfg) === JSON.stringify(saved) || save.isPending}
            onClick={() =>
              save.mutate(cfg, {
                onSuccess: () =>
                  rescore.mutate(undefined, {
                    onSuccess: () => toast.success("Saved — rescoring signals in the background"),
                  }),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            Save & rescore
          </Button>
        </div>
      }
    >
      <div className="divide-y">
        <SettingsRow
          label="Recency half-life (days)"
          htmlFor="rel-hl"
          description="A signal loses half its recency weight every N days."
        >
          <Input
            id="rel-hl"
            type="number"
            min={0.5}
            max={90}
            step={0.5}
            className="w-24 text-right"
            value={cfg.halfLifeDays}
            onChange={(e) => setCfg({ ...cfg, halfLifeDays: Number(e.target.value) })}
          />
        </SettingsRow>
        <div className="grid gap-2 py-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOURCE_CATALOG.filter((s) => s.kind !== "private-future").map((s) => (
            <label key={s.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="truncate">{s.label}</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="h-7 w-20 text-right"
                aria-label={`Source weight for ${s.label}`}
                value={cfg.sourceWeights[s.id] ?? 0.5}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sourceWeights: { ...cfg.sourceWeights, [s.id]: num(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="grid gap-2 py-3 sm:grid-cols-3">
          {["Strategic", "Growth", "Maintain"].map((t) => (
            <label key={t} className="flex items-center justify-between gap-2 text-[13px]">
              <span>{t} tier factor</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="h-7 w-20 text-right"
                aria-label={`${t} tier factor`}
                value={cfg.tierFactors[t] ?? 0.6}
                onChange={(e) =>
                  setCfg({ ...cfg, tierFactors: { ...cfg.tierFactors, [t]: num(e.target.value) } })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
