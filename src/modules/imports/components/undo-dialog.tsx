"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

interface Impact {
  created: number;
  merged: number;
  dependent: { opportunities: number; contacts: number; signals: number };
}

/** Confirms an undo and spells out what it removes, including data added since the import. */
export function UndoImportDialog({
  batchId,
  trigger,
  onDone,
}: {
  batchId: string;
  trigger: ReactNode;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const impact = useQuery({
    queryKey: ["import-impact", batchId],
    queryFn: () => api<Impact>(`/api/import/batches/${batchId}`),
    enabled: open,
  });
  const undo = useMutation({
    mutationFn: () => api(`/api/import/batches/${batchId}/undo`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Import undone");
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });
  const d = impact.data?.dependent;
  const extra = d ? d.opportunities + d.contacts + d.signals : 0;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undo this import?</DialogTitle>
          <DialogDescription>
            {impact.data
              ? `Deletes ${impact.data.created} record${impact.data.created === 1 ? "" : "s"} this import created${impact.data.merged ? ` and restores ${impact.data.merged} merged record${impact.data.merged === 1 ? "" : "s"} to their previous values` : ""}.`
              : "Checking what this import changed…"}
          </DialogDescription>
        </DialogHeader>
        {d && extra > 0 && (
          <p
            className="border-warning/50 bg-warning/10 text-warning-text rounded-md border p-3 text-[13px]"
            role="alert"
          >
            Accounts from this import now also have {d.opportunities} opportunities, {d.contacts}{" "}
            contacts and {d.signals} signals added since. Those are deleted with the accounts.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!impact.data || undo.isPending}
            onClick={() => undo.mutate()}
          >
            {undo.isPending ? "Undoing…" : "Undo import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
