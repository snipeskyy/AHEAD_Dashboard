"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Upload } from "lucide-react";
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
import { useMeta } from "@/hooks/use-meta";
import { api } from "@/lib/api-client";
import { SettingsRow, SettingsSection } from "./section";

export function DataSettings() {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const [confirm, setConfirm] = useState(false);
  const reset = useMutation({
    mutationFn: () => api<{ message: string }>("/api/demo/reset", { method: "POST" }),
    onSuccess: () => {
      toast.success("Demo data reset");
      setConfirm(false);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6">
      <SettingsSection
        title="Workspace data"
        description="Stored in a local SQLite database. Nothing leaves this machine except public-source fetches you enable."
      >
        <div className="divide-y">
          <SettingsRow label="Backup" description="Download every table as a single JSON file.">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/backup" download>
                <Download /> Export JSON
              </a>
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Import target accounts"
            description="Add your own target accounts by public name, domain, and ticker."
          >
            <Button variant="outline" size="sm" asChild>
              <Link href="/accounts/import">
                <Upload /> Import CSV
              </Link>
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Reset demo data"
            description={
              meta
                ? `${meta.counts.demoAccounts} demo accounts · ${meta.counts.realAccounts} of your accounts (kept)`
                : "Regenerates fictional demo data."
            }
          >
            <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>
              <RotateCcw /> Reset demo data
            </Button>
          </SettingsRow>
        </div>
      </SettingsSection>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>
              All fictional demo accounts, opportunities, signals, and touches will be regenerated
              from the fixed seed. Accounts you added are not touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={reset.isPending} onClick={() => reset.mutate()}>
              {reset.isPending ? "Resetting…" : "Reset demo data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
