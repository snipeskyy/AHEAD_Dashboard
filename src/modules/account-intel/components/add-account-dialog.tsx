"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { TIERS } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";

export function AddAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <AddAccountForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddAccountForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [f, setF] = useState({ name: "", domain: "", ticker: "", industry: "", tier: "Growth" });
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; name: string }>("/api/accounts", {
        method: "POST",
        json: {
          ...f,
          domain: f.domain || undefined,
          ticker: f.ticker || undefined,
          industry: f.industry || undefined,
        },
      }),
    onSuccess: (a) => {
      toast.success(`Added ${a.name}`);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["meta"] });
      onDone();
      router.push(`/accounts/${a.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.name.trim().length >= 2) create.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add a target account</DialogTitle>
        <DialogDescription>
          Use public identifiers only. The account is enriched exclusively from public sources you
          enable.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-name">Company name</Label>
        <Input id="acc-name" value={f.name} onChange={set("name")} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="acc-domain">Domain</Label>
          <Input
            id="acc-domain"
            value={f.domain}
            onChange={set("domain")}
            placeholder="example.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acc-ticker">Ticker</Label>
          <Input id="acc-ticker" value={f.ticker} onChange={set("ticker")} placeholder="Optional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acc-industry">Industry</Label>
          <Input
            id="acc-industry"
            value={f.industry}
            onChange={set("industry")}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acc-tier">Tier</Label>
          <select
            id="acc-tier"
            className="border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2.5 text-sm"
            value={f.tier}
            onChange={set("tier")}
          >
            {TIERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={f.name.trim().length < 2 || create.isPending}>
          Add account
        </Button>
      </DialogFooter>
    </form>
  );
}
