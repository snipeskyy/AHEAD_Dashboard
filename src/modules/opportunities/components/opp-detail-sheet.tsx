"use client";
import { format } from "date-fns";
import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { NotesList } from "@/components/notes-list";
import { CardSkeleton, ErrorState } from "@/components/states";
import { TagPicker } from "@/components/tag-picker";
import { InlineDate, InlineNumber, InlineSelect, InlineText } from "@/components/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { useSetting } from "@/hooks/use-setting";
import { FORECAST_CATEGORIES, STAGES, STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { formatCurrency } from "@/lib/format";
import { DEAL_RISK_LABELS } from "@/lib/scoring/deal-risk";
import { useOpportunity, useUpdateOpportunity, type OppPatch } from "../hooks/use-opportunities";
import { StageBadge } from "./badges";
import { forecastLabel } from "./opp-filters";
import { MeddpiccPanel } from "./meddpicc-panel";

export function OppDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {id && <OppDetail id={id} />}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
  internal,
}: {
  label: string;
  children: React.ReactNode;
  internal?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[120px_1fr] items-center gap-2 py-1"
      data-internal-only={internal ? "true" : undefined}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OppDetail({ id }: { id: string }) {
  const { data: o, isLoading, error, refetch } = useOpportunity(id);
  const update = useUpdateOpportunity();
  const { data: lists } = useSetting("pipeline.lists");
  const patch = (p: OppPatch) => update.mutate({ id, patch: p });

  if (isLoading)
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Loading opportunity</SheetTitle>
        <CardSkeleton lines={8} />
      </div>
    );
  if (error || !o)
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Error</SheetTitle>
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );

  return (
    <>
      <SheetHeader className="border-b p-5">
        <div className="flex items-center gap-2">
          <StageBadge stage={o.stage} />
          {o.riskFlags.length > 0 && (
            <span className="text-critical-text text-xs" data-internal-only="true">
              {o.riskFlags.map((f) => DEAL_RISK_LABELS[f]).join(" · ")}
            </span>
          )}
        </div>
        <SheetTitle className="text-lg">{o.name}</SheetTitle>
        <SheetDescription asChild>
          <Link
            href={`/accounts/${o.accountId}`}
            className="hover:text-foreground inline-flex w-fit items-center gap-1 text-[13px] hover:underline"
          >
            {o.accountName} <ExternalLink className="size-3" />
          </Link>
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-6 p-5">
        <section aria-label="Deal fields" className="divide-y">
          <Field label="Name">
            <InlineText label="Name" value={o.name} onCommit={(v) => patch({ name: v })} />
          </Field>
          <Field label="Stage" internal>
            <InlineSelect
              label="Stage"
              value={o.stage}
              options={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
              onCommit={(v) => patch({ stage: v as Stage })}
            />
          </Field>
          <Field label="Practice area">
            <InlineSelect
              label="Practice area"
              value={o.practiceArea}
              options={DEFAULT_PRACTICE_AREAS.map((p) => ({ value: p.id, label: p.label }))}
              onCommit={(v) => patch({ practiceArea: v })}
            />
          </Field>
          <Field label="Amount" internal>
            <InlineNumber
              label="Amount"
              value={o.amount}
              format={formatCurrency}
              className="text-left"
              onCommit={(v) => patch({ amount: v })}
            />
          </Field>
          <Field label="Probability" internal>
            <InlineNumber
              label="Probability"
              value={o.probability}
              max={100}
              format={(v) => `${v}%`}
              className="text-left"
              onCommit={(v) => patch({ probability: Math.round(v) })}
            />
          </Field>
          <Field label="Forecast" internal>
            <InlineSelect
              label="Forecast category"
              value={o.forecastCategory}
              options={FORECAST_CATEGORIES.map((c) => ({ value: c, label: forecastLabel(c) }))}
              onCommit={(v) => patch({ forecastCategory: v })}
            />
          </Field>
          <Field label="Close date">
            <div className="flex items-center gap-2">
              <InlineDate
                label="Close date"
                value={o.closeDate}
                onCommit={(iso) => patch({ closeDate: iso })}
              />
              {o.closeDatePushes > 0 && (
                <span className="text-muted-foreground text-xs" data-internal-only="true">
                  pushed {o.closeDatePushes}×
                </span>
              )}
            </div>
          </Field>
          <Field label="Next step">
            <div className="grid gap-1.5">
              <InlineText
                label="Next step"
                value={o.nextStep ?? ""}
                placeholder="Add next step…"
                onCommit={(v) => patch({ nextStep: v || null })}
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Due</span>
                <InlineDate
                  label="Next step due date"
                  value={o.nextStepDate ?? ""}
                  onCommit={(iso) => patch({ nextStepDate: iso || null })}
                />
                {o.riskFlags.includes("no-next-step") && (
                  <span className="text-warning-text inline-flex items-center gap-1" role="status">
                    <AlertTriangle className="size-3" aria-hidden /> Needs a dated next step
                  </span>
                )}
              </div>
            </div>
          </Field>
          <Field label="Partners / OEMs">
            <TagPicker
              label="Partner"
              value={o.partners}
              options={lists?.partners ?? []}
              onChange={(v) => patch({ partners: v })}
            />
          </Field>
          <Field label="Competitors" internal>
            <TagPicker
              label="Competitor"
              value={o.competitors}
              options={lists?.competitors ?? []}
              onChange={(v) => patch({ competitors: v })}
            />
          </Field>
        </section>

        <section data-internal-only="true">
          <MeddpiccPanel
            key={o.id}
            value={o.meddpicc}
            stage={o.stage}
            onChange={(m) => patch({ meddpicc: m })}
          />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Stage history</h3>
          <ol className="relative grid gap-3 border-l pl-4">
            {o.stageHistory.map((h) => (
              <li key={h.id} className="text-[13px]">
                <span
                  className="border-card bg-primary absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2"
                  aria-hidden
                />
                <span className="font-medium">{STAGE_LABELS[h.toStage as Stage] ?? h.toStage}</span>
                {h.fromStage && (
                  <span className="text-muted-foreground">
                    {" "}
                    from {STAGE_LABELS[h.fromStage as Stage] ?? h.fromStage}
                  </span>
                )}
                <div className="text-muted-foreground text-xs">
                  {format(new Date(h.changedAt), "MMM d, yyyy")}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          <NotesList entityType="opportunity" entityId={o.id} compact />
        </section>
      </div>
    </>
  );
}
