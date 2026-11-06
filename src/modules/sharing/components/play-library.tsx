"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { downloadFrom, readJsonFile } from "./download";

interface Plan { createdBy: { name: string }; plays: Array<{ slug: string; name: string; practiceArea: string; status: "new" | "changed" | "same" }> }

/** Export your Play Library for the team; import a teammate's to standardize plays. */
export function PlayLibrary() {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<unknown>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const exp = useMutation({ mutationFn: () => downloadFrom("/api/play-packs/export"), onSuccess: (n) => toast.success(`Saved ${n}`), onError: (e) => toast.error(e.message) });
  const load = useMutation({
    mutationFn: async (f: File) => { const p = await readJsonFile(f); return { p, plan: await api<Plan>("/api/play-packs/preview", { method: "POST", json: { pack: p } }) }; },
    onSuccess: (r) => { setPack(r.p); setPlan(r.plan); },
    onError: (e) => toast.error(e.message.includes("Invalid") ? "That isn't an ACC play library file" : e.message),
  });
  const imp = useMutation({
    mutationFn: () => api<{ created: number; updated: number; skipped: number }>("/api/play-packs/import", { method: "POST", json: { pack, overwrite } }),
    onSuccess: (r) => { toast.success(`Plays imported: ${r.created} new, ${r.updated} updated, ${r.skipped} unchanged`); setPlan(null); qc.invalidateQueries({ queryKey: ["plays"] }); },
    onError: (e) => toast.error(e.message),
  });
  const n = (s: string) => plan?.plays.filter((p) => p.status === s).length ?? 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-card grid h-fit gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Share your Play Library</h2>
        <p className="text-muted-foreground text-[13px]">Plays are methodology (personas, triggers, talk track, sequence): no account data. The file includes every play in your library.</p>
        <Button className="w-fit" variant="outline" onClick={() => exp.mutate()} disabled={exp.isPending}><Download /> Download plays</Button>
      </section>
      <section className="bg-card grid h-fit gap-3 rounded-lg border p-4" aria-label="Import plays">
        <h2 className="text-sm font-semibold">Import a teammate&apos;s plays</h2>
        <input ref={ref} type="file" accept="application/json,.json" className="sr-only" aria-label="Play library file (.json)" onChange={(e) => { const f = e.target.files?.[0]; if (f) load.mutate(f); e.target.value = ""; }} />
        <Button className="w-fit" variant="outline" onClick={() => ref.current?.click()}><FileUp /> Choose file</Button>
        {plan && (
          <>
            <p className="text-[13px]" role="status">From {plan.createdBy.name}: {n("new")} new, {n("changed")} different from yours, {n("same")} identical.</p>
            <ul className="max-h-48 divide-y overflow-auto rounded-md border text-[13px]">
              {plan.plays.map((p) => <li key={p.slug} className="flex justify-between px-3 py-1"><span>{p.name}</span><span className="text-muted-foreground text-xs">{p.status}</span></li>)}
            </ul>
            <div className="flex items-center gap-2"><Switch id="pl-over" checked={overwrite} onCheckedChange={setOverwrite} /><Label htmlFor="pl-over" className="font-normal">Replace my version of plays that differ (standardize on the team&apos;s)</Label></div>
            <Button className="w-fit" onClick={() => imp.mutate()} disabled={imp.isPending}>Import plays</Button>
          </>
        )}
      </section>
    </div>
  );
}
