"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { api } from "@/lib/api-client";
import { DEFAULT_HEALTH_WEIGHTS, type HealthWeights } from "@/lib/scoring/health";
import { RelevanceSettings } from "./relevance-settings";
import { SettingsSection } from "./section";

const LABELS: Record<keyof HealthWeights, string> = {
  engagement: "Engagement recency",
  coverage: "Buying-committee coverage",
  momentum: "Pipeline momentum",
  signals: "Signal activity",
  quality: "Opportunity quality (MEDDPICC)",
  risk: "Deal risk (inverted)",
};

export function ScoringSettings() {
  const { data } = useSetting("scoring.health");
  // Keyed on the saved value so the editor re-initializes after saves / external changes.
  return (
    <div className="grid gap-6">
      {data && <HealthWeightsEditor key={JSON.stringify(data)} saved={data} />}
      <RelevanceSettings />
    </div>
  );
}

function HealthWeightsEditor({ saved }: { saved: HealthWeights }) {
  const qc = useQueryClient();
  const save = useSaveSetting("scoring.health");
  const [draft, setDraft] = useState<HealthWeights>(saved);
  const total = Object.values(draft).reduce((s, v) => s + v, 0);

  const recompute = useMutation({
    mutationFn: () => api<{ ms: number }>("/api/settings/recompute-scores", { method: "POST" }),
    onSuccess: (r) => {
      toast.success(`Scores recomputed in ${r.ms} ms`);
      qc.invalidateQueries();
    },
  });

  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Account health weights"
        description={
          <>
            Health = Σ(weight × sub-score) ÷ Σ(weight) × 100. Weights are normalized, so only their
            ratios matter.
          </>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_HEALTH_WEIGHTS)}>
              Reset
            </Button>
            <Button
              size="sm"
              disabled={save.isPending || recompute.isPending}
              onClick={() =>
                save.mutate(draft, {
                  onSuccess: () => recompute.mutate(),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <RefreshCw className={recompute.isPending ? "animate-spin" : ""} /> Save & recompute
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          {(Object.keys(LABELS) as Array<keyof HealthWeights>).map((k) => (
            <div
              key={k}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[220px_1fr_64px]"
            >
              <span id={`w-${k}`} className="text-[13px]">
                {LABELS[k]}
              </span>
              <Slider
                aria-labelledby={`w-${k}`}
                className="col-span-2 sm:col-span-1"
                min={0}
                max={0.5}
                step={0.05}
                value={[draft[k]]}
                onValueChange={([v]) => setDraft({ ...draft, [k]: v })}
              />
              <span className="text-muted-foreground tabular row-start-1 text-right text-xs sm:row-auto">
                {total ? Math.round((draft[k] / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>
      <SettingsSection
        title="Other scores"
        description="Whitespace and MEDDPICC formulas are shown alongside each score."
      >
        <ul className="text-muted-foreground grid gap-2 text-[13px]">
          <li>
            <span className="text-foreground font-medium">Whitespace</span> = Σ(weight × gap × (1 +
            0.5 × demand)) ÷ Σ(weight × 1.5) × 100
          </li>
          <li>
            <span className="text-foreground font-medium">Signal relevance</span> = 100 × recency
            (7-day half-life) × source weight × practice match × tier factor
          </li>
          <li>
            <span className="text-foreground font-medium">MEDDPICC completeness</span> = average of
            8 fields scored 0 / 0.5 / 1
          </li>
        </ul>
      </SettingsSection>
    </div>
  );
}
