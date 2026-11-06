"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api-client";
import type { Rules, SmartEntity } from "@/lib/daily/smart-lists";
import { QueryBuilder } from "./query-builder";

export interface ListDef { id?: string; name: string; entity: SmartEntity; rules: Rules; pinned: boolean }
interface Results { total: number; of: number; items: Array<{ id: string; href: string; title: string; sub: string }> }

export function Results({ r }: { r: Results }) {
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground text-xs" role="status">{r.total} of {r.of} match</p>
      <ul className="divide-y rounded-md border">
        {r.items.map((x) => <li key={x.id} className="px-3 py-1.5 text-[13px]"><Link href={x.href} className="font-medium hover:underline">{x.title}</Link> <span className="text-muted-foreground text-xs">· {x.sub}</span></li>)}
        {!r.items.length && <li className="text-muted-foreground px-3 py-3 text-xs">Nothing matches yet.</li>}
      </ul>
    </div>
  );
}

/** Create or edit a smart list with a live preview of what matches. */
export function ListEditor({ initial, onSaved }: { initial: ListDef; onSaved?: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [d, setD] = useState(initial);
  const dq = useDebounced(JSON.stringify({ entity: d.entity, rules: d.rules }), 300);
  const preview = useQuery({ queryKey: ["smart-preview", dq], queryFn: () => api<Results>("/api/smart-lists/preview", { method: "POST", json: JSON.parse(dq) }) });
  const save = useMutation({
    mutationFn: () => (d.id ? api(`/api/smart-lists/${d.id}`, { method: "PATCH", json: d }) : api<{ id: string }>("/api/smart-lists", { method: "POST", json: d })),
    onSuccess: (r) => {
      toast.success("Smart list saved");
      qc.invalidateQueries({ queryKey: ["smart-lists"] });
      if (!d.id) router.push(`/lists/${(r as { id: string }).id}`);
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="bg-card grid gap-3 rounded-lg border p-4" aria-label="Definition">
        <div className="grid gap-1.5"><Label htmlFor="sl-name">Name</Label><Input id="sl-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Strategic, AI evidence, no AI opp" /></div>
        <div className="grid gap-1.5">
          <Label htmlFor="sl-entity">List of</Label>
          <select id="sl-entity" className="border-input dark:bg-input/30 h-8 w-48 rounded-md border bg-transparent px-2 text-sm" value={d.entity} disabled={!!d.id} onChange={(e) => setD({ ...d, entity: e.target.value as SmartEntity, rules: { match: "all", rules: [] } })}>
            <option value="account">Accounts</option><option value="opportunity">Opportunities</option><option value="signal">Signals</option>
          </select>
        </div>
        <QueryBuilder entity={d.entity} value={d.rules} onChange={(rules) => setD({ ...d, rules })} />
        <div className="flex items-center gap-2"><Switch id="sl-pin" checked={d.pinned} onCheckedChange={(v) => setD({ ...d, pinned: v })} /><Label htmlFor="sl-pin" className="font-normal">Pin to sidebar</Label></div>
        <Button className="w-fit" disabled={d.name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>Save list</Button>
      </section>
      <section className="bg-card rounded-lg border p-4" aria-label="Preview">
        <h2 className="mb-2 text-sm font-semibold">Preview</h2>
        {preview.data ? <Results r={preview.data} /> : <p className="text-muted-foreground text-xs">Calculating…</p>}
      </section>
    </div>
  );
}
