"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Eraser, TriangleAlert, Upload } from "lucide-react";
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

interface PurgeResult {
  backup: string | null;
  removed: { accounts: number } | null;
}

export function DataSettings() {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const [confirm, setConfirm] = useState<null | "purge" | "clear-plays">(null);

  const purge = useMutation({
    mutationFn: () => api<PurgeResult>("/api/demo/purge", { method: "POST" }),
    onSuccess: (r) => {
      toast.success(
        r.removed ? `Removed ${r.removed.accounts} demo accounts` : "No demo data found",
        { description: r.backup ? `Backup saved to ${r.backup}` : undefined },
      );
      setConfirm(null);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  const starter = useMutation({
    mutationFn: (action: "clear" | "restore") =>
      api<{ removed?: number; keptInUse?: number; restored?: number }>("/api/plays/starter", {
        method: "POST",
        json: { action },
      }),
    onSuccess: (r) => {
      if (r.restored !== undefined) toast.success(`Restored ${r.restored} Starter Plays`);
      else
        toast.success(`Cleared ${r.removed} Starter Plays`, {
          description: r.keptInUse ? `${r.keptInUse} kept because campaigns use them` : undefined,
        });
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["plays"] });
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
            label="Import data"
            description="Accounts, contacts, opportunities, notes and partner reps from CSV, Excel or a pasted list."
          >
            <Button variant="outline" size="sm" asChild>
              <Link href="/import">
                <Upload /> Open import
              </Link>
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Starter Plays"
            description="Generic demand-gen methodology that ships with ACC. Clearing keeps any play a campaign uses."
          >
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={starter.isPending}
                onClick={() => starter.mutate("restore")}
              >
                <BookOpen /> Restore
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirm("clear-plays")}>
                <Eraser /> Clear
              </Button>
            </div>
          </SettingsRow>
          {meta?.demo && (
            <SettingsRow
              label="Demo data"
              description={`${meta.counts.demoAccounts} fictional demo accounts are in this database. A JSON backup is written to backups/ before anything is deleted.`}
            >
              <Button variant="destructive" size="sm" onClick={() => setConfirm("purge")}>
                <TriangleAlert /> Remove demo data
              </Button>
            </SettingsRow>
          )}
        </div>
      </SettingsSection>
      <p className="text-muted-foreground text-xs">
        Full reset (deletes everything): stop the app and run <code>npm run db:reset</code>. It asks
        for confirmation and writes a backup first.
      </p>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "purge" ? "Remove all demo data?" : "Clear the Starter Plays?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "purge"
                ? "Deletes every fictional account with its opportunities, signals, touches, campaigns, events, notes, activity and export history. Your real accounts and everything on them are kept. Demo plays stay as Starter Plays."
                : "Removes the generic Starter Plays that no campaign uses. Your own plays are kept. You can restore them here later."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={purge.isPending || starter.isPending}
              onClick={() => (confirm === "purge" ? purge.mutate() : starter.mutate("clear"))}
            >
              {confirm === "purge"
                ? purge.isPending
                  ? "Removing…"
                  : "Remove demo data"
                : "Clear Starter Plays"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
