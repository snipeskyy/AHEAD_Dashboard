"use client";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useState } from "react";
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
import { practiceLabel } from "@/config/practice-areas";
import { TOUCH_CHANNELS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useSignalConvert, type SignalRow } from "../hooks/use-signals";

const sel =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

interface PlayMatch {
  play: {
    id: string;
    name: string;
    practiceArea: string;
    valueHypothesis: string;
    sequence: Array<{ day: number; channel: string; description: string }>;
    targetPersonas: string[];
  };
  why: string;
}

export function ConvertToPlayDialog({
  signal,
  onClose,
}: {
  signal: SignalRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!signal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {signal && <PlayForm key={signal.id} signal={signal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PlayForm({ signal, onClose }: { signal: SignalRow; onClose: () => void }) {
  const convert = useSignalConvert();
  const { data } = useQuery({
    queryKey: ["plays", "for-signal", signal.id],
    queryFn: () =>
      api<{ items: PlayMatch[]; all: Array<{ id: string; name: string; practiceArea: string }> }>(
        `/api/plays/for-signal?signalId=${signal.id}`,
      ),
  });
  const [playId, setPlayId] = useState<string | null>(null);
  const [start, setStart] = useState(tomorrow());
  const chosen = playId ?? data?.items[0]?.play.id ?? null;
  const others = (data?.all ?? []).filter((p) => !data?.items.some((m) => m.play.id === p.id));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (chosen)
          convert.mutate(
            {
              id: signal.id,
              body: {
                to: "play",
                playId: chosen,
                startDate: new Date(`${start}T12:00:00Z`).toISOString(),
              },
            },
            { onSuccess: onClose },
          );
      }}
    >
      <DialogHeader>
        <DialogTitle>Convert to play</DialogTitle>
        <DialogDescription>
          Launches a campaign for {signal.accountName}: one planned touch per step of the
          play&apos;s sequence, linked to this signal.
        </DialogDescription>
      </DialogHeader>
      <div role="radiogroup" aria-label="Play" className="grid max-h-72 gap-2 overflow-y-auto">
        {(data?.items ?? []).map((m) => (
          <button
            key={m.play.id}
            type="button"
            role="radio"
            aria-checked={chosen === m.play.id}
            onClick={() => setPlayId(m.play.id)}
            className={cn(
              "hover:bg-muted/50 rounded-md border p-3 text-left transition-colors",
              chosen === m.play.id && "border-primary bg-brand-soft",
            )}
          >
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <Lightbulb className="text-primary size-3.5" /> {m.play.name}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Fits because it {m.why.startsWith("mentions") ? m.why : `matches: ${m.why}`} ·{" "}
              {m.play.sequence.length} steps · {practiceLabel(m.play.practiceArea, true)}
            </div>
          </button>
        ))}
        {data && data.items.length === 0 && (
          <p className="text-muted-foreground text-[13px]">
            No play is triggered by this signal. Pick any play below.
          </p>
        )}
      </div>
      {others.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="other-play">Or choose another play</Label>
          <select
            id="other-play"
            className={sel}
            value={others.some((o) => o.id === chosen) ? chosen! : ""}
            onChange={(e) => e.target.value && setPlayId(e.target.value)}
          >
            <option value="">—</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="play-start">Start date</Label>
        <Input
          id="play-start"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-44"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!chosen || convert.isPending}>
          Launch play
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConvertToTouchDialog({
  signal,
  onClose,
}: {
  signal: SignalRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!signal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {signal && <TouchForm key={signal.id} signal={signal} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function TouchForm({ signal, onClose }: { signal: SignalRow; onClose: () => void }) {
  const convert = useSignalConvert();
  const { data: personas } = useQuery({
    queryKey: ["account-personas", signal.accountId],
    queryFn: () =>
      api<{ contacts: Array<{ title: string }> }>(`/api/accounts/${signal.accountId}`).then((r) => [
        ...new Set(r.contacts.map((c) => c.title)),
      ]),
  });
  const [f, setF] = useState({
    channel: "email",
    persona: "",
    date: tomorrow(),
    angle: `Re: ${signal.title}`.slice(0, 200),
  });
  const persona = f.persona || personas?.[0] || "";
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        convert.mutate(
          {
            id: signal.id,
            body: {
              to: "touch",
              channel: f.channel,
              persona,
              scheduledAt: new Date(`${f.date}T15:00:00Z`).toISOString(),
              angle: f.angle,
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <DialogHeader>
        <DialogTitle>Plan a touch</DialogTitle>
        <DialogDescription>
          Adds a planned outreach for {signal.accountName}, linked to this signal.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="t-ch">Channel</Label>
          <select
            id="t-ch"
            className={sel}
            value={f.channel}
            onChange={(e) => setF({ ...f, channel: e.target.value })}
          >
            {TOUCH_CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-date">Date</Label>
          <Input
            id="t-date"
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-persona">Persona</Label>
        <Input
          id="t-persona"
          list="t-personas"
          value={persona}
          onChange={(e) => setF({ ...f, persona: e.target.value })}
          placeholder="e.g. Chief Information Officer"
        />
        <datalist id="t-personas">
          {personas?.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-angle">Angle</Label>
        <Input
          id="t-angle"
          value={f.angle}
          onChange={(e) => setF({ ...f, angle: e.target.value })}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!persona || convert.isPending}>
          Plan touch
        </Button>
      </DialogFooter>
    </form>
  );
}
