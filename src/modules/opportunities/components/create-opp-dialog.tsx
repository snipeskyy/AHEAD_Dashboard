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
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { OPEN_STAGES, STAGE_LABELS, type Stage } from "@/lib/domain/enums";
import { useCreateOpportunity } from "../hooks/use-opportunities";

export interface CreateOppDefaults {
  account?: { id: string; name: string } | null;
  practiceArea?: string;
  name?: string;
  sourceSignalId?: string;
  nextStep?: string;
}

const selectCls =
  "h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export function CreateOppDialog({
  open,
  onOpenChange,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: CreateOppDefaults;
  onCreated?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <CreateOppForm
            key={JSON.stringify(defaults ?? {})}
            defaults={defaults}
            onDone={(id) => {
              onOpenChange(false);
              if (id) onCreated?.(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateOppForm({
  defaults,
  onDone,
}: {
  defaults?: CreateOppDefaults;
  onDone: (id?: string) => void;
}) {
  const create = useCreateOpportunity();
  const [account, setAccount] = useState(defaults?.account ?? null);
  const [name, setName] = useState(defaults?.name ?? "");
  const [practiceArea, setPractice] = useState(defaults?.practiceArea ?? "ai-infra");
  const [stage, setStage] = useState<Stage>("Qualify");
  const [amount, setAmount] = useState("");
  const [closeDate, setCloseDate] = useState(() =>
    new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
  );
  const [nextStep, setNextStep] = useState(defaults?.nextStep ?? "");
  const amt = Number(amount.replace(/[$,\s]/g, ""));
  const valid =
    account &&
    name.trim().length >= 2 &&
    Number.isFinite(amt) &&
    amt >= 0 &&
    amount !== "" &&
    closeDate;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        create.mutate(
          {
            accountId: account.id,
            name: name.trim(),
            practiceArea,
            stage,
            amount: amt,
            closeDate: new Date(`${closeDate}T12:00:00Z`).toISOString(),
            nextStep: nextStep || null,
            sourceSignalId: defaults?.sourceSignalId ?? null,
          },
          { onSuccess: (row) => onDone(row.id) },
        );
      }}
      className="grid gap-4"
    >
      <DialogHeader>
        <DialogTitle>New opportunity</DialogTitle>
        <DialogDescription>
          Stage history, MEDDPICC and risk tracking start automatically.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="opp-account">Account</Label>
        <AccountPicker id="opp-account" value={account} onChange={setAccount} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="opp-name">Name</Label>
        <Input
          id="opp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GPU cluster phase 1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="opp-practice">Practice area</Label>
          <select
            id="opp-practice"
            className={selectCls}
            value={practiceArea}
            onChange={(e) => setPractice(e.target.value)}
          >
            {DEFAULT_PRACTICE_AREAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-stage">Stage</Label>
          <select
            id="opp-stage"
            className={selectCls}
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
          >
            {OPEN_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-amount">Amount (USD)</Label>
          <Input
            id="opp-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="250000"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opp-close">Close date</Label>
          <Input
            id="opp-close"
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="opp-next">Next step</Label>
        <Input
          id="opp-next"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="Optional"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || create.isPending}>
          Create opportunity
        </Button>
      </DialogFooter>
    </form>
  );
}
