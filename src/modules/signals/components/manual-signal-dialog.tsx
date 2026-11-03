"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { SIGNAL_TYPES, SIGNAL_TYPE_LABELS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";

/** Manual entry: paste a public URL + notes; tagged and scored like any other signal. */
export function ManualSignalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <Form onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [f, setF] = useState({ url: "", title: "", type: "", notes: "" });
  const save = useMutation({
    mutationFn: () =>
      api("/api/signals", {
        method: "POST",
        json: {
          accountId: account!.id,
          url: f.url,
          title: f.title,
          type: f.type || undefined,
          notes: f.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Signal added");
      qc.invalidateQueries({ queryKey: ["signals"] });
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const urlOk = /^https?:\/\/\S+\.\S+/.test(f.url);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (account && urlOk && f.title.length >= 3) save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add a signal</DialogTitle>
        <DialogDescription>
          Paste a public URL (press release, article, filing) and add your notes.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-account">Account</Label>
        <AccountPicker id="ms-account" value={account} onChange={setAccount} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-url">Public URL</Label>
        <Input
          id="ms-url"
          type="url"
          value={f.url}
          onChange={(e) => setF({ ...f, url: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-title">Headline</Label>
        <Input
          id="ms-title"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-type">Type</Label>
        <select
          id="ms-type"
          className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm"
          value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value })}
        >
          <option value="">Auto-detect</option>
          {SIGNAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {SIGNAL_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ms-notes">Notes</Label>
        <Textarea
          id="ms-notes"
          rows={3}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!account || !urlOk || f.title.length < 3 || save.isPending}>
          Add signal
        </Button>
      </DialogFooter>
    </form>
  );
}
