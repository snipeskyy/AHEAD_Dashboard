"use client";
import { useMutation } from "@tanstack/react-query";
import { Calculator, Copy, FileOutput, Play, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { CapacityPanel, IssueList } from "../components/capacity-panel";
import { ComparePanel } from "../components/compare-panel";
import { FloorTab } from "../components/floor-tab";
import { OpsConsole } from "../components/ops-console";
import type { CameraPreset } from "../components/three-view";
import { useScenario } from "../components/use-scenario";
import { roomCalc } from "../lib/calc";
import { createLibrary, LIBRARY_DISCLAIMER } from "../lib/library";

const ThreeView = dynamic(() => import("../components/three-view").then((m) => m.ThreeView), {
  ssr: false,
  loading: () => <div className="bg-muted h-[520px] animate-pulse rounded-md" />,
});
const Tour = dynamic(() => import("../components/tour").then((m) => m.Tour), { ssr: false });
const lib = createLibrary();

/** DC Sandbox scenario: floor plan, 3D, capacity, simulated ops, compare, and a guided tour. */
export default function ScenarioPage({ params }: { params: Record<string, string> }) {
  const router = useRouter();
  const s = useScenario(params.id);
  const [tab, setTab] = useState("floor");
  const [heat, setHeat] = useState(true);
  const [preset, setPreset] = useState<CameraPreset>("overview");
  const [selected, setSelected] = useState<{ kind: "rack" | "unit"; id: string } | null>(null);
  const [touring, setTouring] = useState(false);
  const calc = useMemo(() => (s.spec ? roomCalc(s.spec, lib) : null), [s.spec]);
  const whatIf = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/api/sandbox/${params.id}/duplicate`, { method: "POST", json: {} }),
    onSuccess: (c) => {
      toast.success("What-if copy created");
      router.push(`/sandbox/${c.id}`);
    },
  });
  const tco = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/business-cases", {
        method: "POST",
        json: {
          name: `${s.data!.name} business case`,
          accountId: s.data!.accountId,
          templateId: "refresh-vs-cloud",
          sandboxId: params.id,
        },
      }),
    onSuccess: (c) => router.push(`/cases/${c.id}`),
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/sandbox/${params.id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/sandbox"),
  });
  if (s.isLoading)
    return (
      <PageContainer>
        <CardSkeleton lines={10} />
      </PageContainer>
    );
  if (s.error || !s.data || !s.spec || !calc)
    return (
      <PageContainer>
        <ErrorState error={s.error} onRetry={() => s.refetch()} />
      </PageContainer>
    );
  const d = s.data;
  const crit = calc.issues.filter((i) => i.severity === "critical");

  return (
    <PageContainer>
      <PageHeader
        title={d.name}
        description={
          <span>
            DC Sandbox
            {d.account && (
              <>
                {" "}
                ·{" "}
                <Link className="underline" href={`/accounts/${d.account.id}`}>
                  {d.account.name}
                </Link>
              </>
            )}
            {d.base && (
              <>
                {" "}
                · what-if of{" "}
                <Link className="underline" href={`/sandbox/${d.base.id}`}>
                  {d.base.name}
                </Link>
              </>
            )}{" "}
            · {LIBRARY_DISCLAIMER}
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => setTouring(true)}>
              <Play /> Customer tour
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => whatIf.mutate()}
              disabled={whatIf.isPending}
            >
              <Copy /> What-if copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => tco.mutate()}
              disabled={tco.isPending}
            >
              <Calculator /> Business case
            </Button>
            {d.accountId && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/exports?account=${d.accountId}`}>
                  <FileOutput /> Export
                </Link>
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete scenario"
              onClick={() => confirm("Delete this scenario?") && del.mutate()}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      <div
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
        aria-live="polite"
      >
        <span>{calc.drawKw.toFixed(1)} kW IT load</span>
        <span>PUE ≈ {calc.pue ? calc.pue.toFixed(2) : "—"}</span>
        <span className={crit.length ? "text-critical-text font-medium" : ""}>
          {crit.length} critical issue{crit.length === 1 ? "" : "s"}
        </span>
        <span>{s.saving ? "Saving…" : "Saved"}</span>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="floor">Floor plan</TabsTrigger>
          <TabsTrigger value="3d">3D view</TabsTrigger>
          <TabsTrigger value="capacity">Capacity & what-ifs</TabsTrigger>
          <TabsTrigger value="ops">Operations (simulated)</TabsTrigger>
          {d.base && <TabsTrigger value="compare">Before / after</TabsTrigger>}
        </TabsList>
        <TabsContent value="floor">
          {tab === "floor" && (
            <FloorTab
              spec={s.spec}
              calc={calc}
              lib={lib}
              commit={s.commit}
              preview={s.preview}
              undo={s.undo}
              redo={s.redo}
              canUndo={s.canUndo}
              canRedo={s.canRedo}
              heat={heat}
              setHeat={setHeat}
              selected={selected}
              setSelected={setSelected}
            />
          )}
        </TabsContent>
        <TabsContent value="3d">
          {tab === "3d" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                {(["overview", "aisle", "rack"] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    onClick={() => setPreset(p)}
                  >
                    {p === "overview"
                      ? "Overview"
                      : p === "aisle"
                        ? "Walk the aisle"
                        : "Selected rack"}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={heat ? "default" : "outline"}
                  onClick={() => setHeat(!heat)}
                  aria-pressed={heat}
                >
                  Heat overlay
                </Button>
              </div>
              <ThreeView
                spec={s.spec}
                calc={calc}
                heat={heat}
                preset={preset}
                selectedId={selected?.kind === "rack" ? selected.id : null}
                onSelect={(id) => {
                  setSelected({ kind: "rack", id });
                  setPreset("rack");
                }}
              />
              <section className="bg-card rounded-lg border p-4" aria-label="Issues">
                <IssueList issues={calc.issues} />
              </section>
            </div>
          )}
        </TabsContent>
        <TabsContent value="capacity">
          {tab === "capacity" && <CapacityPanel spec={s.spec} lib={lib} />}
        </TabsContent>
        <TabsContent value="ops">
          {tab === "ops" && <OpsConsole spec={s.spec} lib={lib} />}
        </TabsContent>
        {d.base && (
          <TabsContent value="compare">
            {tab === "compare" && (
              <ComparePanel
                beforeName={d.base.name}
                before={d.base.spec}
                after={s.spec}
                lib={lib}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
      {touring && <Tour name={d.name} spec={s.spec} lib={lib} onClose={() => setTouring(false)} />}
    </PageContainer>
  );
}
