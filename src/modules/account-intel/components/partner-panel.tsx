"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface AP {
  reps: Array<{ id: string; name: string; title: string | null; partnerCompany: string; opportunities: Array<{ id: string; name: string; stage: string }> }>;
  registrations: Array<{ id: string; partnerCompany: string; status: string; reference: string | null; opportunity: { name: string } | null }>;
}

/** Account 360: partner reps engaged here, the deals they're on, and registrations. */
export function PartnerPanel({ accountId }: { accountId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["partners", "account", accountId], queryFn: () => api<AP>(`/api/partners?accountId=${accountId}`) });
  const { data: opps } = useQuery({
    queryKey: ["opportunities", "account-open", accountId],
    queryFn: () => api<{ items: Array<{ id: string; name: string; stage: string }> }>(`/api/opportunities?accountId=${accountId}`).then((r) => r.items.filter((o) => !o.stage.startsWith("Closed"))),
  });
  const [pick, setPick] = useState<Record<string, string>>({});
  const link = useMutation({
    mutationFn: ({ repId, oppId, on }: { repId: string; oppId: string; on: boolean }) => api(`/api/opportunities/${oppId}/partner-reps`, { method: "POST", json: { repId, on } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
    onError: (e) => toast.error(e.message),
  });
  if (!data || (!data.reps.length && !data.registrations.length))
    return (
      <section className="bg-card rounded-lg border p-4 text-[13px]" data-internal-only="true" aria-label="Partner reps">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Handshake className="size-4" aria-hidden /> Partner reps</h2>
        <p className="text-muted-foreground mt-1 text-xs">No partner reps cover this account yet. <Link href="/partners" className="underline">Add them on Partners</Link>.</p>
      </section>
    );
  return (
    <section className="bg-card grid gap-2 rounded-lg border p-4 text-[13px]" data-internal-only="true" aria-label="Partner reps">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Handshake className="size-4" aria-hidden /> Partner reps</h2>
      <ul className="divide-y">
        {data.reps.map((r) => (
          <li key={r.id} className="grid gap-1 py-2">
            <div><span className="font-medium">{r.name}</span> <span className="text-muted-foreground text-xs">· {r.partnerCompany}{r.title ? ` · ${r.title}` : ""}</span></div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {r.opportunities.map((o) => (
                <span key={o.id} className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5">
                  {o.name}
                  <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Take ${r.name} off ${o.name}`} onClick={() => link.mutate({ repId: r.id, oppId: o.id, on: false })}>×</button>
                </span>
              ))}
              {(opps ?? []).length > 0 && (
                <>
                  <select aria-label={`Put ${r.name} on a deal`} className="border-input dark:bg-input/30 h-6 rounded border bg-transparent px-1 text-xs" value={pick[r.id] ?? ""} onChange={(e) => setPick({ ...pick, [r.id]: e.target.value })}>
                    <option value="">Add to deal…</option>
                    {(opps ?? []).filter((o) => !r.opportunities.some((x) => x.id === o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" disabled={!pick[r.id]} onClick={() => { link.mutate({ repId: r.id, oppId: pick[r.id], on: true }); setPick({ ...pick, [r.id]: "" }); }}>Add</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {data.registrations.length > 0 && (
        <p className="text-muted-foreground text-xs" data-field="partner.registrations">Registrations: {data.registrations.map((g) => `${g.partnerCompany} ${g.reference ?? ""} (${g.status}${g.opportunity ? `, ${g.opportunity.name}` : ""})`).join(" · ")}</p>
      )}
    </section>
  );
}
