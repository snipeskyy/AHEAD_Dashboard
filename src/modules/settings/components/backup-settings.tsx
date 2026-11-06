"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DatabaseBackup, Download, History, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSaveSetting, useSetting } from "@/hooks/use-setting";
import { api } from "@/lib/api-client";
import { SettingsSection } from "./section";

interface B { file: string; kind: string; size: number; createdAt: string }
interface Preview { file: string; version: number; exportedAt: string; counts: Record<string, number> }

const KIND: Record<string, string> = { auto: "Automatic", manual: "Manual", "pre-restore": "Before restore", "pre-purge": "Before demo purge", "pre-reset": "Before reset", "pre-import": "Before import" };
const mb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const MAIN = ["accounts", "opportunities", "contacts", "signals", "tasks", "notes"];

/** Automatic daily backups (kept N days), back up now, upload, and restore with a preview + typed confirmation. */
export function BackupSettings() {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const list = useQuery({ queryKey: ["backups"], queryFn: () => api<{ items: B[] }>("/api/backups").then((r) => r.items) });
  const auto = useSetting("backup.autoDaily");
  const keep = useSetting("backup.keep");
  const saveAuto = useSaveSetting("backup.autoDaily");
  const saveKeep = useSaveSetting("backup.keep");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["backups"] });
  const now = useMutation({ mutationFn: () => api<{ file: string }>("/api/backups", { method: "POST" }), onSuccess: (r) => { toast.success("Backup written", { description: `backups/${r.file}` }); refresh(); }, onError: (e) => toast.error(e.message) });
  const upload = useMutation({
    mutationFn: async (f: File) => {
      const body = new FormData();
      body.set("file", f);
      const res = await fetch("/api/backups", { method: "POST", body });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "Upload failed");
      return d as { file: string };
    },
    onSuccess: async (r) => { refresh(); open.mutate(r.file); },
    onError: (e) => toast.error(e.message),
  });
  const open = useMutation({ mutationFn: (file: string) => api<Preview>(`/api/backups/${encodeURIComponent(file)}`), onSuccess: (p) => { setPreview(p); setConfirm(""); }, onError: (e) => toast.error(e.message) });
  const restore = useMutation({
    mutationFn: () => api<{ safety: string }>("/api/backups/restore", { method: "POST", json: { file: preview!.file, confirm } }),
    onSuccess: (r) => {
      setPreview(null);
      toast.success("Backup restored", { description: `Your previous data was saved as backups/${r.safety}.` });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <SettingsSection
      title="Backups & restore"
      description="JSON snapshots in the backups/ folder next to the app (git-ignored). Restoring replaces all current data; a backup of it is written first."
      actions={
        <div className="flex gap-2">
          <input ref={ref} type="file" accept="application/json,.json" className="sr-only" aria-label="Backup file to restore (.json)" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={upload.isPending}><Upload /> Restore from file…</Button>
          <Button size="sm" onClick={() => now.mutate()} disabled={now.isPending}><DatabaseBackup /> Back up now</Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <Switch id="bk-auto" checked={auto.data ?? true} onCheckedChange={(v) => saveAuto.mutate(v)} />
          <Label htmlFor="bk-auto" className="font-normal">Automatic daily backup (runs in the background worker)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="bk-keep" className="font-normal">Keep the last</Label>
          <Input id="bk-keep" type="number" min={3} max={90} className="h-8 w-16" defaultValue={keep.data ?? 14} key={keep.data} onBlur={(e) => { const n = Number(e.target.value); if (n >= 3 && n <= 90 && n !== keep.data) saveKeep.mutate(n); }} />
          <span className="text-muted-foreground">automatic backups</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Backups">
        <table className="w-full text-[13px]">
          <thead className="text-muted-foreground border-b text-left text-xs"><tr><th className="px-3 py-2 font-medium">Created</th><th className="px-2 font-medium">Type</th><th className="px-2 font-medium">Size</th><th className="px-2"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y">
            {list.data?.map((b) => (
              <tr key={b.file}>
                <td className="tabular px-3 py-1.5">{format(new Date(b.createdAt), "EEE MMM d, yyyy HH:mm")}</td>
                <td className="px-2">{KIND[b.kind] ?? b.kind}</td>
                <td className="tabular text-muted-foreground px-2 text-xs">{mb(b.size)}</td>
                <td className="px-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" className="h-7" asChild><a href={`/api/backups/${encodeURIComponent(b.file)}?download=1`} aria-label={`Download ${b.file}`}><Download /></a></Button>
                  <Button variant="outline" size="sm" className="h-7" onClick={() => open.mutate(b.file)} aria-label={`Restore ${b.file}`}><History /> Restore…</Button>
                </td>
              </tr>
            ))}
            {list.data && !list.data.length && <tr><td colSpan={4} className="text-muted-foreground px-3 py-4 text-center text-xs">No backups yet. The worker writes one each day, or click Back up now.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              Everything in the workspace is replaced with the backup from {preview && format(new Date(preview.exportedAt), "MMM d, yyyy HH:mm")}. Your current data is saved as a &ldquo;Before restore&rdquo; backup first, so you can undo this.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <ul className="grid grid-cols-2 gap-x-4 text-[13px] sm:grid-cols-3" aria-label="Backup contents">
              {MAIN.map((k) => <li key={k}><span className="tabular font-medium">{preview.counts[k] ?? 0}</span> <span className="text-muted-foreground">{k}</span></li>)}
            </ul>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="bk-confirm">Type RESTORE to confirm</Label>
            <Input id="bk-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirm !== "RESTORE" || restore.isPending} onClick={() => restore.mutate()}>{restore.isPending ? "Restoring…" : "Restore"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
