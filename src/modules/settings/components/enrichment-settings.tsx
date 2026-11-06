"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { api } from "@/lib/api-client";
import { SettingsRow, SettingsSection } from "./section";

interface EnrichCfg {
  autoApply: boolean;
  concurrency: number;
  autoRefresh: boolean;
  env: { SEC_USER_AGENT: boolean; ENRICH_USER_AGENT: boolean };
  enrichers: Array<{
    id: string;
    label: string;
    source: string;
    description: string;
    ttlDays: number;
    optional: boolean;
    needsSecUserAgent: boolean;
    enabled: boolean;
  }>;
}

/** Public-data enrichers: on/off (optional ones off by default), auto-apply policy, concurrency, refresh. */
export function EnrichmentSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["enrichment", "settings"],
    queryFn: () => api<EnrichCfg>("/api/enrichment/settings"),
  });
  const { data: enabled } = useSetting("enrichment.enabled");
  const saveEnabled = useSaveSetting("enrichment.enabled");
  const saveAuto = useSaveSetting("enrichment.autoApply");
  const saveRefresh = useSaveSetting("enrichment.autoRefresh");
  const saveConc = useSaveSetting("enrichment.concurrency");
  const done = {
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enrichment"] }),
    onError: (e: Error) => toast.error(e.message),
  };
  if (!data) return null;
  return (
    <SettingsSection
      title="Account enrichment"
      description="Public sources that fill account profiles. Each value keeps its source link; you review anything that isn't a high-confidence fill of an empty field."
    >
      <div className="divide-y">
        <SettingsRow
          label="Auto-fill empty fields"
          description="High-confidence public values fill EMPTY fields automatically (with provenance). Everything else waits for your review. Fields you edit are always locked."
          htmlFor="en-auto"
        >
          <Switch
            id="en-auto"
            checked={data.autoApply}
            onCheckedChange={(v) => saveAuto.mutate(v, done)}
          />
        </SettingsRow>
        <SettingsRow
          label="Refresh when stale"
          description="Re-run each source when its refresh interval passes (filings daily, jobs weekly, firmographics quarterly)."
          htmlFor="en-refresh"
        >
          <Switch
            id="en-refresh"
            checked={data.autoRefresh}
            onCheckedChange={(v) => saveRefresh.mutate(v, done)}
          />
        </SettingsRow>
        <SettingsRow label="Accounts enriched at once" htmlFor="en-conc">
          <select
            id="en-conc"
            className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm"
            value={data.concurrency}
            onChange={(e) => saveConc.mutate(Number(e.target.value), done)}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </SettingsRow>
        <SettingsRow
          label="Contact User-Agent"
          description="SEC requires SEC_USER_AGENT; Wikimedia asks for ENRICH_USER_AGENT (falls back to SEC_USER_AGENT). Set them in .env.local and restart."
        >
          <span className="flex flex-col gap-0.5 text-xs">
            {(["SEC_USER_AGENT", "ENRICH_USER_AGENT"] as const).map((k) => (
              <span
                key={k}
                className={`inline-flex items-center gap-1 ${data.env[k] ? "text-good-text" : "text-muted-foreground"}`}
              >
                {data.env[k] ? (
                  <CheckCircle2 className="size-3.5" aria-hidden />
                ) : (
                  <CircleSlash className="size-3.5" aria-hidden />
                )}{" "}
                {k} {data.env[k] ? "set" : "not set"}
              </span>
            ))}
          </span>
        </SettingsRow>
      </div>
      <ul className="mt-3 divide-y rounded-lg border">
        {data.enrichers.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-4 px-3 py-2.5 text-[13px]">
            <div className="min-w-0">
              <div className="font-medium">
                {e.label}
                {e.optional && (
                  <span className="text-muted-foreground ml-1.5 text-[10px] uppercase">
                    Optional
                  </span>
                )}
                {e.needsSecUserAgent && !data.env.SEC_USER_AGENT && (
                  <span className="text-warning-text ml-1.5 text-[10px] uppercase">
                    Needs SEC_USER_AGENT
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {e.description} Refreshes every {e.ttlDays} day{e.ttlDays === 1 ? "" : "s"}.
              </p>
            </div>
            <Switch
              aria-label={`Enable ${e.label}`}
              checked={e.enabled}
              onCheckedChange={(v) => saveEnabled.mutate({ ...(enabled ?? {}), [e.id]: v }, done)}
            />
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
