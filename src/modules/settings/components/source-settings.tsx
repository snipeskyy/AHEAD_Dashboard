"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { RefreshCw } from "lucide-react";
import { CircleAlert, CircleCheck, CircleDashed, CircleMinus, CircleX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchedulerInterval } from "./scheduler-interval";
import { Switch } from "@/components/ui/switch";
import { ErrorState, CardSkeleton } from "@/components/states";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";
import { EnrichmentSettings } from "./enrichment-settings";

interface SourceStatus {
  id: string;
  label: string;
  kind: string;
  description: string;
  enabled: boolean;
  missingConfig: string | null;
  status: "healthy" | "available" | "error" | "idle" | "needs-config" | "not-configured";
  lastRun: { startedAt: string; ok: boolean; itemsNew: number; error: string | null } | null;
}

const STATUS = {
  healthy: { label: "Healthy", icon: CircleCheck, cls: "text-good-text" },
  available: { label: "Available", icon: CircleCheck, cls: "text-muted-foreground" },
  error: { label: "Error", icon: CircleX, cls: "text-critical-text" },
  idle: { label: "Not run yet", icon: CircleDashed, cls: "text-muted-foreground" },
  "needs-config": { label: "Needs config", icon: CircleAlert, cls: "text-warning-text" },
  "not-configured": { label: "Requires approval", icon: CircleMinus, cls: "text-muted-foreground" },
} as const;

export function SourceSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sources"],
    queryFn: () =>
      api<{
        fetching: boolean;
        intervalMinutes: number;
        publicFetchEnabled: boolean;
        sources: SourceStatus[];
      }>("/api/sources"),
    refetchInterval: (q) => (q.state.data?.fetching ? 3000 : 30_000),
  });
  const fetchNow = useMutation({
    mutationFn: (adapterId?: string) =>
      api("/api/sources/fetch", { method: "POST", json: adapterId ? { adapterId } : {} }),
    onSuccess: () => {
      toast.success("Fetch queued — the worker will pick it up in a moment");
      qc.invalidateQueries({ queryKey: ["sources"] });
    },
  });
  const { data: enabled = {} } = useSetting("sources.enabled");
  const save = useSaveSetting("sources.enabled");

  if (isLoading) return <CardSkeleton lines={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="grid gap-6">
      <SchedulerInterval fetching={data.fetching} onFetchAll={() => fetchNow.mutate(undefined)} />
      <SettingsSection
        title="Data sources"
        description={
          <>
            Public sources only. The background worker fetches every {data.intervalMinutes} minutes.{" "}
            {!data.publicFetchEnabled && (
              <strong>Outbound fetching is disabled by PUBLIC_FETCH_ENABLED=false.</strong>
            )}
          </>
        }
      >
        <ul className="divide-y">
          {data.sources.map((s) => {
            const st = STATUS[s.status];
            return (
              <li key={s.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <st.icon className={`mt-0.5 size-4 shrink-0 ${st.cls}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium">{s.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.kind}
                    </Badge>
                    <span className={`text-xs ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{s.description}</p>
                  {s.missingConfig && (
                    <p className="text-warning-text mt-1 text-xs">
                      Set <code className="bg-muted rounded px-1 font-mono">{s.missingConfig}</code>{" "}
                      in <code className="bg-muted rounded px-1 font-mono">.env.local</code> and
                      restart.
                    </p>
                  )}
                  {s.lastRun && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Last run{" "}
                      {formatDistanceToNowStrict(new Date(s.lastRun.startedAt), {
                        addSuffix: true,
                      })}{" "}
                      · {s.lastRun.itemsNew} new
                      {s.lastRun.error && (
                        <span className="text-critical-text"> · {s.lastRun.error}</span>
                      )}
                    </p>
                  )}
                </div>
                {s.kind !== "private-future" && s.kind !== "manual" && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={!s.enabled || data.fetching || fetchNow.isPending}
                    onClick={() => fetchNow.mutate(s.id)}
                    aria-label={`Fetch ${s.label} now`}
                  >
                    <RefreshCw className={data.fetching ? "animate-spin" : ""} /> Fetch
                  </Button>
                )}
                <Switch
                  checked={s.enabled}
                  disabled={s.kind === "private-future"}
                  aria-label={`Enable ${s.label}`}
                  onCheckedChange={(v) =>
                    save.mutate(
                      { ...enabled, [s.id]: v },
                      {
                        onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </SettingsSection>
      <EnrichmentSettings />
    </div>
  );
}
