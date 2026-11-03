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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { useUiStore } from "@/stores/ui-store";

/** Global "Add note" dialog (command palette → Add note). Attaches to an account picked via search. */
export function NoteDialog() {
  const state = useUiStore((s) => s.noteDialog);
  const close = useUiStore((s) => s.closeNoteDialog);
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && close()}>
      {/* Keyed body: every open starts from a fresh form state. */}
      {state.open && (
        <NoteDialogBody
          key={`${state.entityType}:${state.entityId}`}
          entityType={state.entityType}
          entityId={state.entityId}
          close={close}
        />
      )}
    </Dialog>
  );
}

function NoteDialogBody({
  entityType,
  entityId,
  close,
}: {
  entityType?: string;
  entityId?: string;
  close: () => void;
}) {
  const qc = useQueryClient();
  const [entity, setEntity] = useState<{ type: string; id: string; label: string } | null>(
    entityType && entityId ? { type: entityType, id: entityId, label: "Current record" } : null,
  );
  const [body, setBody] = useState("");
  const [internalOnly, setInternalOnly] = useState(true);

  const save = useMutation({
    mutationFn: () =>
      api("/api/notes", {
        method: "POST",
        json: { entityType: entity!.type, entityId: entity!.id, body, internalOnly },
      }),
    onSuccess: () => {
      toast.success("Note saved");
      qc.invalidateQueries({ queryKey: ["notes"] });
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>
            Notes are stored locally and are internal-only unless you mark them otherwise.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="note-account">Account</Label>
            {entity ? (
              <div className="bg-muted/40 flex h-8 items-center justify-between rounded-md border px-2.5 text-sm">
                <span className="truncate">{entity.label}</span>
                {!entityId && (
                  <Button variant="link" size="xs" onClick={() => setEntity(null)}>
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <AccountPicker
                id="note-account"
                value={null}
                onChange={(a) => a && setEntity({ type: "account", id: a.id, label: a.name })}
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note-body">Note</Label>
            <Textarea
              id="note-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you learn?"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="note-internal" checked={internalOnly} onCheckedChange={setInternalOnly} />
            <Label htmlFor="note-internal" className="font-normal">
              Internal only (hidden in customer-facing exports)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!entity || !body.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  );
}
