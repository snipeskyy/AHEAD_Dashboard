"use client";
import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { FIELD_BY_ID } from "@/lib/enrich/fields";
import { useSetField } from "@/modules/account-intel/hooks/use-enrichment";

interface Item { accountId: string; accountName: string; tier: string; id: string; label: string; weight: number; manual: boolean; prompt?: string; score: number }

function Fill({ it }: { it: Item }) {
  const set = useSetField(it.accountId);
  const [v, setV] = useState("");
  const editable = !!FIELD_BY_ID.get(it.id) && FIELD_BY_ID.get(it.id)!.kind !== "json";
  if (!editable)
    return <Button size="sm" variant="outline" className="h-7" asChild><Link href={it.id === "x.contacts" ? `/accounts/${it.accountId}?tab=committee` : `/accounts/${it.accountId}?tab=${it.id === "x.initiatives" ? "intelligence" : "profile"}`}>Open</Link></Button>;
  return (
    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (v.trim()) set.mutate({ field: it.id, value: v.trim() }); }}>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-7 w-56" aria-label={`${it.label} for ${it.accountName}`} placeholder={it.prompt ?? it.label} />
      <Button type="submit" size="sm" className="h-7" disabled={!v.trim() || set.isPending}>Save</Button>
    </form>
  );
}

/** The most valuable missing fields across the portfolio, fillable in place. */
export default function FixItPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["enrichment", "fix-it"], queryFn: () => api<{ items: Item[] }>("/api/fix-it").then((r) => r.items) });
  return (
    <PageContainer>
      <PageHeader title="Fix-it queue" description="The most valuable missing data across your portfolio, weighted by field importance and account tier. Values you type are locked against enrichment." />
      {isLoading ? <CardSkeleton lines={8} /> : error ? <ErrorState error={error} onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyState icon={Wrench} title="Nothing to fix" description="Every account has the fields that matter for its tier." />
      ) : (
        <section className="bg-card overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label="Fix-it queue">
          <table className="w-full text-left text-[13px]">
            <thead className="text-muted-foreground border-b text-xs"><tr>{["Account", "Tier", "Missing", "Fill in"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {data.map((it) => (
                <tr key={`${it.accountId}:${it.id}`}>
                  <td className="px-4 py-2"><Link href={`/accounts/${it.accountId}?tab=profile`} className="font-medium hover:underline">{it.accountName}</Link></td>
                  <td className="px-4 py-2">{it.tier}</td>
                  <td className="px-4 py-2">{it.label}{it.manual && <span className="text-muted-foreground ml-1.5 text-[10px] uppercase">Only you know</span>}</td>
                  <td className="px-4 py-2"><Fill it={it} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PageContainer>
  );
}
