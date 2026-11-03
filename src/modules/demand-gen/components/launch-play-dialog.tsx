"use client";
import { useState } from "react";
import { AccountPicker } from "@/components/account-picker";
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
import { useLaunchPlay, type Play } from "../hooks/use-demand-gen";

export function LaunchPlayDialog({
  play,
  account,
  onClose,
}: {
  play: Play | null;
  account?: { id: string; name: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!play} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {play && <Form key={play.id} play={play} account={account ?? null} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  play,
  account: initial,
  onClose,
}: {
  play: Play;
  account: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const launch = useLaunchPlay();
  const [account, setAccount] = useState(initial);
  const [start, setStart] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (account)
          launch.mutate(
            {
              playId: play.id,
              accountId: account.id,
              startDate: new Date(`${start}T12:00:00Z`).toISOString(),
            },
            { onSuccess: onClose },
          );
      }}
    >
      <DialogHeader>
        <DialogTitle>Launch “{play.name}”</DialogTitle>
        <DialogDescription>
          Creates a campaign with {play.sequence.length} planned touches, scheduled from the start
          date by the play&apos;s day offsets.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="lp-acc">Account</Label>
        <AccountPicker id="lp-acc" value={account} onChange={setAccount} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lp-start">Start date</Label>
        <Input
          id="lp-start"
          type="date"
          className="w-44"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <ol className="bg-muted/50 grid gap-1 rounded-md p-3 text-xs">
        {play.sequence.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted-foreground tabular w-12 shrink-0">Day {s.day}</span>
            <span className="w-16 shrink-0 capitalize">{s.channel}</span>
            <span className="text-muted-foreground">{s.description}</span>
          </li>
        ))}
      </ol>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!account || launch.isPending}>
          Launch play
        </Button>
      </DialogFooter>
    </form>
  );
}
