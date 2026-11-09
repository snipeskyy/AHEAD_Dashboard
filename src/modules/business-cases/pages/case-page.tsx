"use client";
import { useMutation } from "@tanstack/react-query";
import { FileOutput, GitCommitHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api-client";
import type { TcoModel } from "@/lib/tco/model";
import { Results } from "../components/results";
import { ScenarioEditor } from "../components/scenario-editor";
import { newId, useCase } from "../components/use-case";
import { VersionCompare } from "../components/version-compare";

function Num({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="text-muted-foreground grid gap-0.5 text-[11px]">
      {label}
      <span className="flex items-center gap-1">
        <Input
          type="number"
          step="any"
          className="h-8 w-20 text-[13px]"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value || 0))}
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}

/** TCO / business-case editor: assumptions on the left, live results on the right, versions below. */
export default function CasePage({ params }: { params: Record<string, string> }) {
  const router = useRouter();
  const c = useCase(params.id);
  const [tab, setTab] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const del = useMutation({
    mutationFn: () => api(`/api/business-cases/${params.id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/cases"),
  });
  if (c.isLoading)
    return (
      <PageContainer>
        <CardSkeleton lines={10} />
      </PageContainer>
    );
  if (c.error || !c.data || !c.model)
    return (
      <PageContainer>
        <ErrorState error={c.error} onRetry={() => c.refetch()} />
      </PageContainer>
    );
  const m = c.model;
  const d = c.data;
  const set = (p: Partial<TcoModel>) => c.edit({ ...m, ...p });
  const active = m.scenarios.find((s) => s.id === tab) ?? m.scenarios[0];
  const issue = c.valid && !c.valid.success ? c.valid.error.issues[0] : null;

  return (
    <PageContainer>
      <PageHeader
        title={d.name}
        description={
          <span>
            Business case
            {d.account && (
              <>
                {" "}
                ·{" "}
                <Link className="underline" href={`/accounts/${d.account.id}`}>
                  {d.account.name}
                </Link>
              </>
            )}
            {d.opportunity && (
              <>
                {" "}
                ·{" "}
                <Link className="underline" href={`/opportunities?focus=${d.opportunity.id}`}>
                  {d.opportunity.name}
                </Link>
              </>
            )}
            {" · "}every figure is your assumption; results are estimates.
          </span>
        }
        actions={
          <>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={d.status}
              onValueChange={(v) =>
                v &&
                c.save.mutate({ status: v as "draft" | "final" }, { onSuccess: () => c.refetch() })
              }
              aria-label="Status"
            >
              <ToggleGroupItem value="draft" aria-label="Draft">
                Draft
              </ToggleGroupItem>
              <ToggleGroupItem value="final" aria-label="Final">
                Final
              </ToggleGroupItem>
            </ToggleGroup>
            {d.accountId && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/exports?account=${d.accountId}`}>
                  <FileOutput /> Export
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete business case"
              onClick={() => confirm("Delete this business case and its versions?") && del.mutate()}
            >
              <Trash2 />
            </Button>
          </>
        }
      />
      {issue && (
        <p className="text-critical-text text-xs" role="alert">
          Not saved yet: {issue.path.join(" › ")} {issue.message}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(420px,520px)_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Assumptions">
            <h2 className="text-sm font-semibold">Assumptions</h2>
            <div className="flex flex-wrap gap-3">
              <label className="text-muted-foreground grid gap-0.5 text-[11px]">
                Period
                <select
                  className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]"
                  value={m.years}
                  aria-label="Period (years)"
                  onChange={(e) => set({ years: Number(e.target.value) })}
                >
                  {[3, 5, 7, 10].map((y) => (
                    <option key={y} value={y}>
                      {y} years
                    </option>
                  ))}
                </select>
              </label>
              <Num
                label="Discount rate"
                value={m.discountRatePct}
                suffix="%"
                onChange={(v) => set({ discountRatePct: v })}
              />
              <Num
                label="Demand growth"
                value={m.growthPct}
                suffix="%/yr"
                onChange={(v) => set({ growthPct: v })}
              />
              <label className="text-muted-foreground grid gap-0.5 text-[11px]">
                Baseline
                <select
                  className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-1.5 text-[13px]"
                  value={m.baselineId}
                  aria-label="Baseline scenario"
                  onChange={(e) => set({ baselineId: e.target.value })}
                >
                  {m.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Scenarios">
            <Tabs value={active.id} onValueChange={setTab} className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <TabsList>
                  {m.scenarios.map((s) => (
                    <TabsTrigger key={s.id} value={s.id}>
                      {s.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {m.scenarios.length < 4 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const id = newId("s");
                      set({
                        scenarios: [
                          ...m.scenarios,
                          {
                            id,
                            name: `Option ${m.scenarios.length + 1}`,
                            kind: "custom",
                            lines: [],
                          },
                        ],
                      });
                      setTab(id);
                    }}
                  >
                    <Plus /> Scenario
                  </Button>
                )}
              </div>
              {m.scenarios.map((sc) => (
                <TabsContent key={sc.id} value={sc.id}>
                  {sc.id === active.id && (
                    <ScenarioEditor
                      key={active.id}
                      s={active}
                      years={m.years}
                      isBaseline={active.id === m.baselineId}
                      canRemove={m.scenarios.length > 1}
                      onChange={(s) =>
                        set({ scenarios: m.scenarios.map((x) => (x.id === s.id ? s : x)) })
                      }
                      onRemove={() => {
                        set({ scenarios: m.scenarios.filter((x) => x.id !== active.id) });
                        setTab(null);
                      }}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Versions">
            <h2 className="text-sm font-semibold">Versions</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                c.version.mutate(label, { onSuccess: () => setLabel("") });
              }}
            >
              <Input
                className="h-8"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label, e.g. After customer review"
                aria-label="Version label"
              />
              <Button size="sm" type="submit" variant="outline" disabled={c.version.isPending}>
                <GitCommitHorizontal /> Save v{d.version}
              </Button>
            </form>
            <VersionCompare caseId={d.id} current={m} versions={d.versions} />
          </section>
        </div>
        <Results model={m} />
      </div>
    </PageContainer>
  );
}
