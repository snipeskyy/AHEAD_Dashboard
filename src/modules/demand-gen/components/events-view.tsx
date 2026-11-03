"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { CalendarDays, MapPin, Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { CardSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EVENT_KINDS, INVITE_STATUSES } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string;
  name: string;
  kind: string;
  startsAt: string;
  location: string | null;
  isDemo: boolean;
  invites: Array<{
    id: string;
    accountId: string;
    accountName: string;
    tier: string;
    persona: string | null;
    status: string;
  }>;
}
const sel = "h-8 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

export function EventsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ items: EventRow[] }>("/api/events").then((r) => r.items),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["events"] });
  const events = (data ?? []).filter((e) => showPast || !isPast(new Date(e.startsAt)));
  const open = data?.find((e) => e.id === openId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant={showPast ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowPast(!showPast)}
        >
          {showPast ? "Hide past events" : "Show past events"}
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> New event
        </Button>
      </div>
      {isLoading ? (
        <CardSkeleton lines={6} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => {
            const counts = Object.fromEntries(
              INVITE_STATUSES.map((s) => [s, e.invites.filter((i) => i.status === s).length]),
            );
            const past = isPast(new Date(e.startsAt));
            const needsFollowUp = past
              ? e.invites.filter((i) => i.status === "attended").length
              : 0;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(e.id)}
                  className={cn(
                    "bg-card h-full w-full rounded-lg border p-4 text-left transition-shadow hover:shadow-sm",
                    past && "opacity-80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{e.name}</h3>
                    <Badge variant="outline" className="shrink-0 font-normal capitalize">
                      {e.kind}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {format(new Date(e.startsAt), "EEE MMM d, yyyy")}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {e.location}
                      </span>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="bg-muted rounded px-1.5 py-0.5">
                      {e.invites.length} accounts
                    </span>
                    {INVITE_STATUSES.filter((s) => counts[s]).map((s) => (
                      <span key={s} className="text-muted-foreground rounded border px-1.5 py-0.5">
                        {counts[s]} {s}
                      </span>
                    ))}
                  </div>
                  {needsFollowUp > 0 && (
                    <p className="text-warning-text mt-2 text-xs font-medium">
                      {needsFollowUp} attendee{needsFollowUp > 1 ? "s" : ""} awaiting follow-up
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <EventSheet event={open} onClose={() => setOpenId(null)} onChange={refresh} />
      <NewEventDialog open={creating} onClose={() => setCreating(false)} onCreated={refresh} />
    </div>
  );
}

function EventSheet({
  event,
  onClose,
  onChange,
}: {
  event: EventRow | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const invite = useMutation({
    mutationFn: () =>
      api(`/api/events/${event!.id}/invites`, { method: "POST", json: { accountId: account!.id } }),
    onSuccess: () => {
      setAccount(null);
      onChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = async (id: string, status: string) => {
    await api(`/api/event-invites/${id}`, { method: "PATCH", json: { status } });
    onChange();
  };
  const remove = async (id: string) => {
    await api(`/api/event-invites/${id}`, { method: "DELETE" });
    onChange();
  };
  const del = async () => {
    await api(`/api/events/${event!.id}`, { method: "DELETE" });
    toast.success("Event deleted");
    onChange();
    onClose();
  };
  return (
    <Sheet open={!!event} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {event && (
          <>
            <SheetHeader>
              <SheetTitle>{event.name}</SheetTitle>
              <SheetDescription>
                {format(new Date(event.startsAt), "EEEE MMMM d, yyyy")}
                {event.location ? ` · ${event.location}` : ""} ·{" "}
                <span className="capitalize">{event.kind}</span>
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (account) invite.mutate();
                }}
              >
                <div className="flex-1">
                  <AccountPicker value={account} onChange={setAccount} />
                </div>
                <Button type="submit" size="sm" disabled={!account || invite.isPending}>
                  <UserPlus /> Invite
                </Button>
              </form>
              <ul className="divide-y rounded-md border">
                {event.invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{i.accountName}</div>
                      <div className="text-muted-foreground text-xs">
                        {i.persona ?? "Persona TBD"} · {i.tier}
                      </div>
                    </div>
                    <select
                      aria-label={`Invite status for ${i.accountName}`}
                      className={sel}
                      value={i.status}
                      onChange={(e) => setStatus(i.id, e.target.value)}
                    >
                      {INVITE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${i.accountName}`}
                      onClick={() => remove(i.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
                {event.invites.length === 0 && (
                  <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                    No accounts invited yet.
                  </li>
                )}
              </ul>
              <Button variant="ghost" size="sm" className="w-fit" onClick={del}>
                <Trash2 /> Delete event
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NewEventDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState(() => ({
    name: "",
    kind: "roundtable",
    date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    location: "",
  }));
  const create = useMutation({
    mutationFn: () =>
      api("/api/events", {
        method: "POST",
        json: {
          name: f.name,
          kind: f.kind,
          startsAt: new Date(`${f.date}T17:00:00Z`).toISOString(),
          location: f.location || null,
        },
      }),
    onSuccess: () => {
      toast.success("Event created");
      onCreated();
      onClose();
      setF({ ...f, name: "", location: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.name.trim().length >= 3) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              Conferences, webinars, partner events and executive briefings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-name">Name</Label>
            <Input
              id="ev-name"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-kind">Kind</Label>
              <select
                id="ev-kind"
                className={sel}
                value={f.kind}
                onChange={(e) => setF({ ...f, kind: e.target.value })}
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-date">Date</Label>
              <Input
                id="ev-date"
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-loc">Location</Label>
            <Input
              id="ev-loc"
              value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })}
              placeholder="City or Virtual"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={f.name.trim().length < 3 || create.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
