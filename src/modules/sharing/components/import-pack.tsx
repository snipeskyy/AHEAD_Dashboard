"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { readJsonFile } from "./download";

type Decision = "merge" | "create" | "skip";
interface Row { ref: string; name: string; domain: string | null; match: { id: string; name: string; by: string } | null; decision: Decision; counts: Record<string, number> }
interface Preview { title: string; createdBy: { name: string; role: string }; createdAt: string; sections: string[]; accounts: Row[] }

const sel = "border-input dark:bg-input/30 h-7 rounded-md border bg-transparent px-1.5 text-xs";
const summary = (c: Record<string, number>) => Object.entries(c).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(" · ") || "identity only";

/** Upload a teammate's pack → preview matches → choose merge/create/skip → import (undoable from Import → History). */
export function ImportPack() {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; pack: unknown } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [done, setDone] = useState<{ batchId: string; counts: Record<string, number>; items: number } | null>(null);
  const load = useMutation({
    mutationFn: async (f: File) => {
      const pack = await readJsonFile(f);
      const p = await api<Preview>("/api/packs/preview", { method: "POST", json: { pack } });
      return { f, pack, p };
    },
    onSuccess: ({ f, pack, p }) => { setFile({ name: f.name, pack }); setPreview(p); setDec(Object.fromEntries(p.accounts.map((a) => [a.ref, a.decision]))); setDone(null); },
    onError: (e) => toast.error(e.message.includes("Invalid") ? "That isn't an ACC pack (or it's from a newer version)" : e.message),
  });
  const commit = useMutation({
    mutationFn: () => api<{ batchId: string; counts: Record<string, number>; items: number }>("/api/packs/import", { method: "POST", json: { pack: file!.pack, decisions: dec, fileName: file!.name } }),
    onSuccess: (r) => { setDone(r); setPreview(null); qc.invalidateQueries(); toast.success("Pack imported"); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4">
      <section className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-4">
        <input ref={ref} type="file" accept="application/json,.json" className="sr-only" aria-label="Pack file (.json)" onChange={(e) => { const f = e.target.files?.[0]; if (f) load.mutate(f); e.target.value = ""; }} />
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={load.isPending}><FileUp /> Choose pack file</Button>
        <p className="text-muted-foreground text-xs">Accounts are matched by domain, then legal name. Profile values arrive as proposals you review; nothing overwrites your data.</p>
      </section>
      {preview && (
        <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Pack preview">
          <div>
            <h2 className="text-sm font-semibold">{preview.title}</h2>
            <p className="text-muted-foreground text-xs">From {preview.createdBy.name} ({preview.createdBy.role}) · {new Date(preview.createdAt).toLocaleDateString()} · includes {preview.sections.join(", ")}</p>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Accounts in pack">
            <table className="w-full text-[13px]">
              <thead className="text-muted-foreground text-left text-xs"><tr><th className="py-1 pr-3 font-medium">Account</th><th className="pr-3 font-medium">In your workspace</th><th className="pr-3 font-medium">Contents</th><th className="font-medium">Action</th></tr></thead>
              <tbody className="divide-y">
                {preview.accounts.map((a) => (
                  <tr key={a.ref}>
                    <td className="py-1.5 pr-3 font-medium">{a.name}{a.domain && <span className="text-muted-foreground font-normal"> · {a.domain}</span>}</td>
                    <td className="pr-3 text-xs">{a.match ? <>Matches <Link className="underline" href={`/accounts/${a.match.id}`}>{a.match.name}</Link> by {a.match.by}</> : <span className="text-muted-foreground">New</span>}</td>
                    <td className="text-muted-foreground pr-3 text-xs">{summary(a.counts)}</td>
                    <td>
                      <select aria-label={`Action for ${a.name}`} className={sel} value={dec[a.ref]} onChange={(e) => setDec({ ...dec, [a.ref]: e.target.value as Decision })}>
                        {a.match && <option value="merge">Merge into match</option>}
                        <option value="create">Create new</option>
                        <option value="skip">Skip</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button className="w-fit" disabled={commit.isPending} onClick={() => commit.mutate()}>Import pack</Button>
        </section>
      )}
      {done && (
        <section className="bg-card rounded-lg border p-4 text-[13px]" role="status">
          <p className="font-medium">Imported: {done.counts.created} new account(s), {done.counts.merged} merged, {done.counts.skipped} skipped · {done.items} items added.</p>
          <p className="text-muted-foreground mt-1 text-xs">Review profile values in each account&apos;s Profile tab (Proposed updates). Changed your mind? <Link href="/import?tab=history" className="underline">Undo it from Import → History</Link>.</p>
        </section>
      )}
    </div>
  );
}
