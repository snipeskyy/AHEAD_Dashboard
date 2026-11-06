"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { parseActions, parseTags } from "@/lib/daily/notes-parser";
import { useUiStore } from "@/stores/ui-store";

/** Quick capture (C key / ⌘K): paste raw meeting notes into an account; "Action:/Next:/TODO" lines become tasks. */
export function QuickCapture() {
  const open = useUiStore((s) => s.captureOpen);
  const account = useUiStore((s) => s.captureAccount);
  const setOpen = useUiStore((s) => s.setCaptureOpen);
  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      {open && <Body key={account?.id ?? "none"} initial={account ?? null} close={() => setOpen(false)} />}
    </Dialog>
  );
}

function Body({ initial, close }: { initial: { id: string; name: string } | null; close: () => void }) {
  const qc = useQueryClient();
  const [account, setAccount] = useState(initial);
  const [text, setText] = useState("");
  const [now] = useState(() => new Date());
  const actions = useMemo(() => parseActions(text, now), [text, now]);
  const tags = useMemo(() => parseTags(text), [text]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const chosen = actions.filter((a) => !skip.has(a.line));
  const save = useMutation({
    mutationFn: async () => {
      await api("/api/notes", { method: "POST", json: { entityType: "account", entityId: account!.id, body: text.trim(), internalOnly: true, tags } });
      if (chosen.length)
        await api("/api/tasks", {
          method: "POST",
          json: { items: chosen.map((a) => ({ title: a.title, dueDate: a.dueDate?.toISOString() ?? null, accountId: account!.id, source: "quick-capture" })) },
        });
    },
    onSuccess: () => {
      toast.success(chosen.length ? `Note saved · ${chosen.length} task${chosen.length === 1 ? "" : "s"} created` : "Note saved");
      qc.invalidateQueries();
      close();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Quick capture</DialogTitle>
        <DialogDescription>Paste meeting notes. Lines starting with “Action:”, “Next:”, “TODO” or “- [ ]” become tasks; “#tags” are saved with the note.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cap-account">Account</Label>
          <AccountPicker id="cap-account" value={account} onChange={setAccount} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cap-notes">Notes</Label>
          <Textarea id="cap-notes" rows={8} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={"Met with the infrastructure team #ai\nAction: send GPU sizing by Friday\nNext: workshop with security lead"} />
          {tags.length > 0 && <p className="text-muted-foreground text-xs">Tags: {tags.map((t) => `#${t}`).join(" ")}</p>}
        </div>
        {actions.length > 0 && (
          <fieldset className="grid gap-1.5 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium">Create tasks</legend>
            {actions.map((a) => (
              <label key={a.line} className="flex items-center gap-2 text-[13px]">
                <Checkbox checked={!skip.has(a.line)} onCheckedChange={(v) => setSkip((s) => { const n = new Set(s); if (v) n.delete(a.line); else n.add(a.line); return n; })} aria-label={`Create task: ${a.title}`} />
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                {a.dueDate && <span className="text-muted-foreground text-xs">due {a.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </label>
            ))}
          </fieldset>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={close}>Cancel</Button>
        <Button disabled={!account || text.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>
          {chosen.length ? `Save note & ${chosen.length} task${chosen.length === 1 ? "" : "s"}` : "Save note"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
