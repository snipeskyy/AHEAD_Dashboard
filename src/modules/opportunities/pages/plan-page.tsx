"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Download, ListChecks, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { PlanTimeline } from "@/components/plan/plan-timeline";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
  MapPatchSchema,
  customerSteps,
  mapProgress,
  type MapPatch,
  type MapStep,
} from "@/lib/map/model";
import type { PlanDto } from "@/lib/server/action-plans";
import { PlanStepsEditor } from "../components/plan-steps-editor";

const HEALTH: Record<string, { label: string; cls: string }> = {
  "on-track": { label: "✓ On track", cls: "text-good-text" },
  watch: { label: "⚠ Watch", cls: "text-warning-text" },
  "off-track": { label: "⚠ Off track", cls: "text-critical-text" },
  empty: { label: "No steps", cls: "text-muted-foreground" },
};
let seq = 0;
const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Mutual action plan for one opportunity: edit steps, preview the customer view, download a PDF. */
export default function PlanPage({ params }: { params: Record<string, string> }) {
  const id = params.id;
  const q = useQuery({
    queryKey: ["plan", id],
    queryFn: () =>
      api<{ plan: PlanDto | null }>(`/api/opportunities/${id}/plan`).then((r) => r.plan),
  });
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (starter: boolean) =>
      api<{ plan: PlanDto }>(`/api/opportunities/${id}/plan`, {
        method: "POST",
        json: { starter },
      }),
    onSuccess: (r) => qc.setQueryData(["plan", id], r.plan),
    onError: (e) => toast.error(e.message),
  });
  if (q.isLoading)
    return (
      <PageContainer>
        <CardSkeleton lines={8} />
      </PageContainer>
    );
  if (q.error)
    return (
      <PageContainer>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    );
  if (!q.data)
    return (
      <PageContainer>
        <PageHeader
          title="Mutual action plan"
          description="A dated path to a decision that you and the customer agree on."
        />
        <EmptyState
          icon={ListChecks}
          title="No plan for this opportunity yet"
          description="Start from a standard decision path (dates count back from the deal's close date) or from a blank plan."
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => create.mutate(true)} disabled={create.isPending}>
                Start from the standard path
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => create.mutate(false)}
                disabled={create.isPending}
              >
                Start blank
              </Button>
            </div>
          }
        />
      </PageContainer>
    );
  return <PlanEditor key={q.data.id} id={id} initial={q.data} />;
}

function PlanEditor({ id, initial }: { id: string; initial: PlanDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [plan, setPlan] = useState(initial);
  const [tab, setTab] = useState("edit");
  const save = useMutation({
    mutationFn: (p: MapPatch) =>
      api<{ plan: PlanDto }>(`/api/opportunities/${id}/plan`, { method: "PATCH", json: p }),
    onSuccess: (r) => qc.setQueryData(["plan", id], r.plan),
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => api(`/api/opportunities/${id}/plan`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["plan", id] });
      router.push(`/opportunities?view=table&focus=${id}`);
    },
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const update = (p: Partial<PlanDto>) => {
    const next = { ...plan, ...p };
    setPlan(next);
    const patch: MapPatch = {
      title: next.title,
      objective: next.objective,
      targetDate: next.targetDate,
      steps: next.steps,
    };
    if (timer.current) clearTimeout(timer.current);
    if (MapPatchSchema.safeParse(patch).success)
      timer.current = setTimeout(() => save.mutate(patch), 600);
  };
  const now = new Date();
  const progress = mapProgress(plan.steps, plan.targetDate, now);
  const h = HEALTH[progress.health];
  const valid = MapPatchSchema.safeParse({ title: plan.title, steps: plan.steps }).success;

  return (
    <PageContainer>
      <PageHeader
        title="Mutual action plan"
        description={
          <span>
            <Link className="underline" href={`/opportunities?focus=${plan.opportunityId}`}>
              {plan.opportunity.name}
            </Link>{" "}
            ·{" "}
            <Link className="underline" href={`/accounts/${plan.opportunity.accountId}`}>
              {plan.opportunity.accountName}
            </Link>
          </span>
        }
        actions={
          <>
            <Button size="sm" asChild>
              <a
                href={`/api/opportunities/${id}/plan/pdf?audience=customer`}
                download
                aria-label="Download customer PDF"
              >
                <Download /> Customer PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild data-internal-only="true">
              <a
                href={`/api/opportunities/${id}/plan/pdf?audience=internal`}
                download
                aria-label="Download internal PDF"
              >
                <Download /> Internal PDF
              </a>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete plan"
              onClick={() => confirm("Delete this plan?") && del.mutate()}
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
        <span className={`font-medium ${h.cls}`}>{h.label}</span>
        <span>{progress.summary}</span>
        {progress.next && <span>Next: {progress.next.title}</span>}
        <span>
          {!valid ? "Fix the highlighted fields to save" : save.isPending ? "Saving…" : "Saved"}
        </span>
      </div>
      <section
        className="bg-card grid gap-3 rounded-lg border p-4 md:grid-cols-[2fr_1fr]"
        aria-label="Plan details"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="map-title">Plan title</Label>
          <Input
            id="map-title"
            value={plan.title}
            aria-invalid={plan.title.trim().length < 2}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="map-target">Target decision date</Label>
          <Input
            id="map-target"
            type="date"
            value={plan.targetDate ?? ""}
            onChange={(e) => update({ targetDate: e.target.value || null })}
          />
        </div>
        <div className="grid gap-1.5 md:col-span-2">
          <Label htmlFor="map-objective">Customer objective (shown to the customer)</Label>
          <Textarea
            id="map-objective"
            rows={2}
            value={plan.objective ?? ""}
            placeholder="What the customer wants to achieve, in their words"
            onChange={(e) => update({ objective: e.target.value || null })}
          />
        </div>
      </section>
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="edit">Steps</TabsTrigger>
          <TabsTrigger value="customer">
            <CalendarCheck className="size-3.5" aria-hidden /> Customer view
          </TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <PlanStepsEditor
            steps={plan.steps}
            onChange={(steps: MapStep[]) => update({ steps })}
            newId={newId}
          />
        </TabsContent>
        <TabsContent value="customer">
          <div className="bg-card rounded-lg border p-6">
            <PlanTimeline
              title={plan.title}
              accountName={plan.opportunity.accountName}
              objective={plan.objective}
              targetDate={plan.targetDate}
              steps={customerSteps(plan.steps)}
              now={now}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Hidden steps and internal notes are left out of this view and the customer PDF.
          </p>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
