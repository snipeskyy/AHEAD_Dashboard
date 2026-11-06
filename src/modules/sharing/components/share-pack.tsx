"use client";
import { useMutation } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountPicker } from "@/components/account-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/use-me";
import { DEFAULT_PACK_SECTIONS, effectiveSections, PACK_SECTIONS } from "@/lib/team/pack-schema";
import { downloadFrom } from "./download";

/** Choose accounts and what to include; role-gated sections are locked off. */
export function SharePack() {
  const role = useMe().data?.user.role ?? "associate-client-director";
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [sections, setSections] = useState<string[]>(DEFAULT_PACK_SECTIONS);
  const [title, setTitle] = useState("");
  const allowed = new Set(effectiveSections(PACK_SECTIONS.map((s) => s.id), role));
  const effective = effectiveSections(sections, role);
  const go = useMutation({
    mutationFn: () => downloadFrom("/api/packs/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountIds: accounts.map((a) => a.id), sections, title }) }),
    onSuccess: (name) => toast.success("Pack downloaded", { description: `${name}: send it to a teammate; they import it under Team & sharing → Import a pack.` }),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-card grid h-fit gap-3 rounded-lg border p-4" aria-label="Accounts to share">
        <h2 className="text-sm font-semibold">1. Accounts</h2>
        <AccountPicker key={accounts.length} value={null} placeholder="Add an account…" onChange={(a) => a && !accounts.some((x) => x.id === a.id) && setAccounts([...accounts, a])} />
        <ul className="flex flex-wrap gap-1" aria-label="Selected accounts">
          {accounts.map((a) => (
            <li key={a.id}><Badge variant="secondary" className="gap-1 pr-1 font-normal">{a.name}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAccounts(accounts.filter((x) => x.id !== a.id))}><X className="size-3" /></button></Badge></li>
          ))}
          {!accounts.length && <li className="text-muted-foreground text-xs">No accounts selected.</li>}
        </ul>
        <div className="grid gap-1.5"><Label htmlFor="pk-title">Pack title (optional)</Label><Input id="pk-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Healthcare accounts for Sam" /></div>
      </section>
      <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="What to include">
        <h2 className="text-sm font-semibold">2. What to include</h2>
        <ul className="grid gap-2">
          {PACK_SECTIONS.map((s) => {
            const locked = !allowed.has(s.id);
            const on = effective.includes(s.id);
            return (
              <li key={s.id} className="flex items-start gap-2 text-[13px]">
                <Checkbox id={`pk-${s.id}`} checked={on} disabled={locked} onCheckedChange={(v) => setSections(v ? [...sections, s.id] : sections.filter((x) => x !== s.id))} aria-describedby={`pk-${s.id}-hint`} />
                <label htmlFor={`pk-${s.id}`} className={locked ? "text-muted-foreground" : ""}>
                  {s.label}
                  <span id={`pk-${s.id}-hint`} className="text-muted-foreground block text-xs">{locked ? "Hidden for your role." : s.hint}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground text-xs">Packs never include signals, tasks, meetings or partner registrations. Your teammate reviews profile values before they apply.</p>
        <Button className="w-fit" disabled={!accounts.length || go.isPending} onClick={() => go.mutate()}><Download /> Download pack</Button>
      </section>
    </div>
  );
}
