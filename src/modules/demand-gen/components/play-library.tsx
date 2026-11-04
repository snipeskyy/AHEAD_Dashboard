"use client";
import { BookOpen, Copy, Pencil, Play as PlayIcon, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FilterChip } from "@/components/data-table";
import { CardSkeleton, EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DEFAULT_PRACTICE_AREAS, practiceLabel } from "@/config/practice-areas";
import { SIGNAL_TYPE_LABELS, type SignalType } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { formatPercent } from "@/lib/format";
import { useInvalidateDemandGen, usePlays, type Play } from "../hooks/use-demand-gen";
import { LaunchPlayDialog } from "./launch-play-dialog";
import { PlayFormDialog } from "./play-form-dialog";

export function PlayLibrary() {
  const { data, isLoading } = usePlays();
  const inv = useInvalidateDemandGen();
  const [q, setQ] = useState("");
  const [practice, setPractice] = useState<string[]>([]);
  const [detail, setDetail] = useState<Play | null>(null);
  const [launch, setLaunch] = useState<Play | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; play: Play | null }>({
    open: false,
    play: null,
  });
  const plays = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          (!practice.length || practice.includes(p.practiceArea)) &&
          (!q || `${p.name} ${p.valueHypothesis}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, q, practice],
  );

  const duplicate = async (p: Play) => {
    await api("/api/plays", {
      method: "POST",
      json: {
        name: `${p.name} (copy)`,
        practiceArea: p.practiceArea,
        targetPersonas: p.targetPersonas,
        triggerKeywords: p.triggerKeywords,
        triggerSignalTypes: p.triggerSignalTypes,
        valueHypothesis: p.valueHypothesis,
        talkTrack: p.talkTrack,
        sequence: p.sequence,
        assetsNeeded: p.assetsNeeded,
        successMetrics: p.successMetrics,
      },
    });
    toast.success("Play duplicated");
    inv();
  };
  const remove = async (p: Play) => {
    await api(`/api/plays/${p.id}`, { method: "DELETE" });
    toast.success("Play deleted");
    setDetail(null);
    inv();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plays…"
            className="h-8 w-56 pl-8"
            aria-label="Search plays"
          />
        </div>
        <FilterChip
          label="Practice"
          options={DEFAULT_PRACTICE_AREAS.map((p) => ({ value: p.id, label: p.label }))}
          value={practice}
          onChange={setPractice}
        />
        <Button size="sm" className="ml-auto" onClick={() => setEdit({ open: true, play: null })}>
          <Plus /> New play
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : plays.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={q || practice.length ? "No plays match these filters" : "No plays yet"}
          description={
            q || practice.length
              ? "Clear the search or practice filter to see every play."
              : "Create your first play, or restore the Starter Plays in Settings → Data."
          }
          action={
            <Button size="sm" onClick={() => setEdit({ open: true, play: null })}>
              <Plus /> New play
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plays.map((p) => (
            <li key={p.id}>
              <article className="bg-card flex h-full flex-col rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left text-sm font-semibold hover:underline"
                    onClick={() => setDetail(p)}
                  >
                    {p.name}
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {p.origin === "starter" && (
                      <Badge variant="outline" className="text-muted-foreground font-normal">
                        Starter
                      </Badge>
                    )}
                    <Badge variant="secondary" className="font-normal">
                      {practiceLabel(p.practiceArea, true)}
                    </Badge>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                  {p.valueHypothesis}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.triggerSignalTypes.slice(0, 4).map((t) => (
                    <Badge key={t} variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                      {SIGNAL_TYPE_LABELS[t as SignalType] ?? t}
                    </Badge>
                  ))}
                </div>
                <dl className="text-muted-foreground mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-center text-[11px]">
                  <div>
                    <dt>Campaigns</dt>
                    <dd className="text-foreground tabular text-sm font-semibold">
                      {p.stats.campaigns}
                    </dd>
                  </div>
                  <div>
                    <dt>Touches</dt>
                    <dd className="text-foreground tabular text-sm font-semibold">
                      {p.stats.completed}
                    </dd>
                  </div>
                  <div>
                    <dt>Meeting rate</dt>
                    <dd className="text-foreground tabular text-sm font-semibold">
                      {p.stats.completed
                        ? formatPercent(p.stats.meetings / p.stats.completed)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Opps</dt>
                    <dd className="text-foreground tabular text-sm font-semibold">
                      {p.stats.opps}
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto flex gap-2 pt-3">
                  <Button size="sm" variant="outline" onClick={() => setLaunch(p)}>
                    <PlayIcon /> Launch
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDetail(p)}>
                    Details
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <Badge variant="secondary" className="w-fit font-normal">
                  {practiceLabel(detail.practiceArea)}
                </Badge>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>{detail.valueHypothesis}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6 text-[13px]">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setLaunch(detail)}>
                    <PlayIcon /> Launch for account
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEdit({ open: true, play: detail })}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => duplicate(detail)}>
                    <Copy /> Duplicate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(detail)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
                <Section title="Target personas">
                  <ul className="flex flex-wrap gap-1">
                    {detail.targetPersonas.map((x) => (
                      <Badge key={x} variant="outline" className="font-normal">
                        {x}
                      </Badge>
                    ))}
                  </ul>
                </Section>
                <Section title="Triggers">
                  <p className="text-muted-foreground">
                    Keywords: {detail.triggerKeywords.join(", ") || "—"}
                  </p>
                  <p className="text-muted-foreground">
                    Signal types:{" "}
                    {detail.triggerSignalTypes
                      .map((t) => SIGNAL_TYPE_LABELS[t as SignalType] ?? t)
                      .join(", ") || "—"}
                  </p>
                </Section>
                <Section title="Talk track">
                  <ol className="list-decimal space-y-1 pl-4">
                    {detail.talkTrack.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ol>
                </Section>
                <Section title="Sequence">
                  <ol className="relative grid gap-2 border-l pl-4">
                    {detail.sequence.map((s, i) => (
                      <li key={i}>
                        <span
                          className="border-card bg-primary absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2"
                          aria-hidden
                        />
                        <span className="font-medium">
                          Day {s.day} · <span className="capitalize">{s.channel}</span>
                        </span>
                        <div className="text-muted-foreground">{s.description}</div>
                      </li>
                    ))}
                  </ol>
                </Section>
                <Section title="Assets needed">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {detail.assetsNeeded.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Success metrics">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {detail.successMetrics.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Effectiveness">
                  <p className="text-muted-foreground">
                    {detail.stats.campaigns} campaigns · {detail.stats.completed} completed touches
                    → {detail.stats.replies} replies → {detail.stats.meetings} meetings →{" "}
                    {detail.stats.opps} opportunities
                  </p>
                </Section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <LaunchPlayDialog play={launch} onClose={() => setLaunch(null)} />
      <PlayFormDialog
        open={edit.open}
        play={edit.play}
        onClose={() => {
          setEdit({ open: false, play: null });
          setDetail(null);
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
