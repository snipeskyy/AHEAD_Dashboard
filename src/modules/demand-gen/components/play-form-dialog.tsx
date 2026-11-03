"use client";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { SIGNAL_TYPES, SIGNAL_TYPE_LABELS, TOUCH_CHANNELS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { useInvalidateDemandGen, type Play } from "../hooks/use-demand-gen";

const sel =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const csv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function PlayFormDialog({
  play,
  open,
  onClose,
}: {
  play: Play | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {open && <PlayForm key={play?.id ?? "new"} play={play} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PlayForm({ play, onClose }: { play: Play | null; onClose: () => void }) {
  const inv = useInvalidateDemandGen();
  const [f, setF] = useState({
    name: play?.name ?? "",
    practiceArea: play?.practiceArea ?? DEFAULT_PRACTICE_AREAS[0].id,
    personas: (play?.targetPersonas ?? []).join(", "),
    keywords: (play?.triggerKeywords ?? []).join(", "),
    types: play?.triggerSignalTypes ?? [],
    valueHypothesis: play?.valueHypothesis ?? "",
    talkTrack: (play?.talkTrack ?? []).join("\n"),
    assets: (play?.assetsNeeded ?? []).join("\n"),
    metrics: (play?.successMetrics ?? []).join("\n"),
    sequence: play?.sequence ?? [{ day: 0, channel: "email", description: "" }],
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name,
        practiceArea: f.practiceArea,
        targetPersonas: csv(f.personas),
        triggerKeywords: csv(f.keywords),
        triggerSignalTypes: f.types,
        valueHypothesis: f.valueHypothesis,
        talkTrack: lines(f.talkTrack),
        sequence: f.sequence.filter((s) => s.description.trim()),
        assetsNeeded: lines(f.assets),
        successMetrics: lines(f.metrics),
      };
      return play
        ? api(`/api/plays/${play.id}`, { method: "PUT", json: body })
        : api("/api/plays", { method: "POST", json: body });
    },
    onSuccess: () => {
      toast.success(play ? "Play updated" : "Play created");
      inv();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });
  const valid =
    f.name.trim().length >= 3 &&
    f.valueHypothesis.trim().length >= 5 &&
    f.sequence.some((s) => s.description.trim());
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{play ? "Edit play" : "New play"}</DialogTitle>
        <DialogDescription>
          Plays are reusable outreach recipes. Triggers let the recommender match them to signals.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pf-name">Name</Label>
          <Input id="pf-name" value={f.name} onChange={set("name")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pf-practice">Practice area</Label>
          <select
            id="pf-practice"
            className={sel}
            value={f.practiceArea}
            onChange={set("practiceArea")}
          >
            {DEFAULT_PRACTICE_AREAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="pf-personas">Target personas (comma-separated)</Label>
          <Input
            id="pf-personas"
            value={f.personas}
            onChange={set("personas")}
            placeholder="Chief Information Officer, VP, Infrastructure & Operations"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pf-kw">Trigger keywords (comma-separated)</Label>
          <Input
            id="pf-kw"
            value={f.keywords}
            onChange={set("keywords")}
            placeholder="GPU, inference"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Trigger signal types</Label>
          <div className="flex flex-wrap gap-1">
            {SIGNAL_TYPES.map((t) => {
              const on = f.types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setF({ ...f, types: on ? f.types.filter((x) => x !== t) : [...f.types, t] })
                  }
                  className={`rounded border px-1.5 py-0.5 text-[11px] ${on ? "border-primary bg-brand-soft text-primary" : "text-muted-foreground"}`}
                >
                  {SIGNAL_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-vh">Value hypothesis</Label>
        <Textarea id="pf-vh" rows={2} value={f.valueHypothesis} onChange={set("valueHypothesis")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pf-tt">Talk track (one question per line)</Label>
        <Textarea id="pf-tt" rows={3} value={f.talkTrack} onChange={set("talkTrack")} />
      </div>
      <div className="grid gap-1.5">
        <Label>Sequence</Label>
        {f.sequence.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={`Step ${i + 1} day`}
              type="number"
              min={0}
              className="w-20"
              value={s.day}
              onChange={(e) =>
                setF({
                  ...f,
                  sequence: f.sequence.map((x, j) =>
                    j === i ? { ...x, day: Number(e.target.value) } : x,
                  ),
                })
              }
            />
            <select
              aria-label={`Step ${i + 1} channel`}
              className={`${sel} w-32`}
              value={s.channel}
              onChange={(e) =>
                setF({
                  ...f,
                  sequence: f.sequence.map((x, j) =>
                    j === i ? { ...x, channel: e.target.value } : x,
                  ),
                })
              }
            >
              {TOUCH_CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Input
              aria-label={`Step ${i + 1} description`}
              value={s.description}
              onChange={(e) =>
                setF({
                  ...f,
                  sequence: f.sequence.map((x, j) =>
                    j === i ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
              placeholder="What happens in this step"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove step ${i + 1}`}
              onClick={() => setF({ ...f, sequence: f.sequence.filter((_, j) => j !== i) })}
              disabled={f.sequence.length === 1}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            setF({
              ...f,
              sequence: [
                ...f.sequence,
                { day: (f.sequence.at(-1)?.day ?? 0) + 3, channel: "email", description: "" },
              ],
            })
          }
        >
          <Plus /> Add step
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pf-assets">Assets needed (one per line)</Label>
          <Textarea id="pf-assets" rows={3} value={f.assets} onChange={set("assets")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pf-metrics">Success metrics (one per line)</Label>
          <Textarea id="pf-metrics" rows={3} value={f.metrics} onChange={set("metrics")} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || save.isPending}>
          {play ? "Save play" : "Create play"}
        </Button>
      </DialogFooter>
    </form>
  );
}
