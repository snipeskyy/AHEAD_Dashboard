"use client";
import { format } from "date-fns";
import { PenLine, Trash2 } from "lucide-react";
import Link from "next/link";
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
import { TOUCH_OUTCOMES } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { useInvalidateDemandGen, useTouchPatch, type Touch } from "../hooks/use-demand-gen";

const sel =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

export function TouchDialog({ touch, onClose }: { touch: Touch | null; onClose: () => void }) {
  return (
    <Dialog open={!!touch} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {touch && <Body key={touch.id} t={touch} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ t, onClose }: { t: Touch; onClose: () => void }) {
  const patch = useTouchPatch();
  const inv = useInvalidateDemandGen();
  const [date, setDate] = useState(t.scheduledAt.slice(0, 10));
  const [outcome, setOutcome] = useState(t.outcome ?? "no-response");
  const done = !!t.completedAt;
  const del = async () => {
    await api(`/api/touches/${t.id}`, { method: "DELETE" });
    toast.success("Touch deleted");
    inv();
    onClose();
  };
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="capitalize">
          {t.channel} → {t.persona}
        </DialogTitle>
        <DialogDescription>
          <Link
            href={`/accounts/${t.accountId}`}
            className="text-foreground font-medium hover:underline"
          >
            {t.account.name}
          </Link>
          {t.campaign ? ` · ${t.campaign.name}` : ""} ·{" "}
          {done
            ? `completed ${format(new Date(t.completedAt!), "MMM d")}`
            : `planned ${format(new Date(t.scheduledAt), "EEE MMM d")}`}
        </DialogDescription>
      </DialogHeader>
      {t.angle && <p className="bg-muted/50 rounded-md p-2.5 text-[13px]">{t.angle}</p>}
      {!done && (
        <div className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="td-date">Reschedule</Label>
            <Input
              id="td-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={date === t.scheduledAt.slice(0, 10) || patch.isPending}
            onClick={() =>
              patch.mutate(
                { id: t.id, patch: { scheduledAt: `${date}${t.scheduledAt.slice(10)}` } },
                { onSuccess: onClose },
              )
            }
          >
            Move
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="td-outcome">Outcome</Label>
          <select
            id="td-outcome"
            className={sel}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            {TOUCH_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() =>
            patch.mutate(
              { id: t.id, patch: { completed: true, outcome } },
              {
                onSuccess: () => {
                  toast.success("Touch logged");
                  onClose();
                },
              },
            )
          }
        >
          {done ? "Update outcome" : "Mark complete"}
        </Button>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" size="sm" onClick={del}>
          <Trash2 /> Delete
        </Button>
        <div className="flex gap-2">
          {done && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patch.mutate({ id: t.id, patch: { completed: false } }, { onSuccess: onClose })
              }
            >
              Reopen
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/demand-gen?tab=messages&account=${t.accountId}&persona=${encodeURIComponent(t.persona)}&channel=${t.channel === "linkedin" || t.channel === "call" ? t.channel : "email"}`}
            >
              <PenLine /> Draft message
            </Link>
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
