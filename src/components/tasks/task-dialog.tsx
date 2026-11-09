"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useUiStore, type TaskDefaults } from "@/stores/ui-store";

const sel = "border-input dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2 text-sm";

/** Global quick-add task (⌘K → "task", or the T key). */
export function TaskDialog() {
  const state = useUiStore((s) => s.taskDialog);
  const close = useUiStore((s) => s.closeTaskDialog);
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      {state.open && <Body key={JSON.stringify(state.defaults ?? {})} d={state.defaults ?? {}} close={close} />}
    </Dialog>
  );
}

function Body({ d, close }: { d: TaskDefaults; close: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(d.title ?? "");
  const [account, setAccount] = useState(d.account ?? null);
  const [due, setDue] = useState(d.dueDate?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState("normal");
  const [recurrence, setRecurrence] = useState("");
  const [assignee, setAssignee] = useState("");
  const users =
    useQuery({
      queryKey: ["users", "list"],
      queryFn: () => api<{ users: Array<{ id: string; displayName: string; isSelf: boolean }> }>("/api/users").then((r) => r.users),
    }).data ?? [];
  const teammates = users.filter((u) => !u.isSelf);
  const save = useMutation({
    mutationFn: () =>
      api("/api/tasks", {
        method: "POST",
        json: {
          title, priority, accountId: account?.id ?? null, opportunityId: d.opportunityId ?? null, signalId: d.signalId ?? null,
          dueDate: due ? new Date(`${due}T17:00:00`).toISOString() : null, recurrence: recurrence || null, source: d.source ?? "manual",
          assigneeId: assignee || null,
        },
      }),
    onSuccess: () => {
      toast.success("Task added");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["my-day"] });
      close();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>Link it to an account so it shows up there and on My Day.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim().length >= 2) save.mutate(); }}>
        <div className="grid gap-1.5">
          <Label htmlFor="task-title">Task</Label>
          <Input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send GPU sizing to the platform team" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-account">Account</Label>
          <AccountPicker id="task-account" value={account} onChange={setAccount} />
        </div>
        {teammates.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="task-assignee">Assign to</Label>
            <select id="task-assignee" className={sel} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Me</option>
              {teammates.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="task-due">Due</Label>
            <Input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-pri">Priority</Label>
            <select id="task-pri" className={sel} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["low", "normal", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-rec">Repeats</Label>
            <select id="task-rec" className={sel} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">Never</option>
              {["weekly", "biweekly", "monthly", "quarterly"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Cancel</Button>
          <Button type="submit" disabled={title.trim().length < 2 || save.isPending}>Add task</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
