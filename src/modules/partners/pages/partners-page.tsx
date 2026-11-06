"use client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { FileBadge, Handshake, Plus, Users } from "lucide-react";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatCurrencyCompact } from "@/lib/format";
import { AddRepDialog, JointTouchDialog, RegistrationDialog } from "../components/dialogs";

interface Partner {
  company: string;
  reps: Array<{ id: string; name: string; title: string | null; territory: string | null; accounts: Array<{ id: string; name: string }>; opportunities: Array<{ id: string; name: string }>; lastJointTouch: string | null }>;
  sharedPipeline: number;
  sharedOpps: number;
  registrations: Array<{ id: string; reference: string | null; status: string; expiresAt: string | null; expired: boolean; account: { id: string; name: string }; opportunity: { id: string; name: string } | null; rep: { name: string } | null }>;
  openRegistrations: number;
  lastJointTouch: string | null;
}
const ago = (iso: string | null) => (iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : "never");

export default function PartnersPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["partners"], queryFn: () => api<{ items: Partner[] }>("/api/partners").then((r) => r.items) });
  return (
    <PageContainer>
      <PageHeader
        title="Partners"
        description="Co-sell with partner and OEM reps. Everything here is entered by you; partner names in deals come from your own lists."
        actions={<AddRepDialog trigger={<Button size="sm"><Plus /> Add rep</Button>} />}
      />
      {isLoading ? <CardSkeleton lines={6} /> : error ? <ErrorState error={error} onRetry={() => refetch()} /> : !data?.length ? (
        <EmptyState icon={Handshake} title="No partners yet" description="Add the partner and OEM reps you work with, or import them (Import → Partner reps). Deals that list a partner show up here too." action={<AddRepDialog trigger={<Button size="sm"><Plus /> Add rep</Button>} />} />
      ) : (
        <div className="grid gap-4">
          {data.map((p) => (
            <section key={p.company} className="bg-card grid gap-3 rounded-lg border p-4" aria-label={p.company}>
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{p.company}</h2>
                  <p className="text-muted-foreground text-xs">
                    <span data-internal-only="true" data-field="opp.amount">{formatCurrencyCompact(p.sharedPipeline)} shared pipeline · </span>
                    {p.sharedOpps} open deals · {p.openRegistrations} open registrations · last joint touch {ago(p.lastJointTouch)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <AddRepDialog company={p.company} trigger={<Button size="sm" variant="outline"><Users /> Add rep</Button>} />
                  <RegistrationDialog company={p.company} reps={p.reps} trigger={<Button size="sm" variant="outline"><FileBadge /> Registration</Button>} />
                </div>
              </header>
              {p.reps.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {p.reps.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-[13px]">
                      <div className="min-w-0">
                        <div className="font-medium">{r.name}{r.title && <span className="text-muted-foreground font-normal">, {r.title}</span>}{r.territory && <span className="text-muted-foreground font-normal"> · {r.territory}</span>}</div>
                        <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-1 text-xs">
                          {r.accounts.map((a) => <Link key={a.id} href={`/accounts/${a.id}`} className="hover:underline"><Badge variant="secondary" className="font-normal">{a.name}</Badge></Link>)}
                          {r.opportunities.length > 0 && <span>· on {r.opportunities.length} deal{r.opportunities.length === 1 ? "" : "s"}</span>}
                          <span>· last joint touch {ago(r.lastJointTouch)}</span>
                        </div>
                      </div>
                      <JointTouchDialog rep={r} trigger={<Button size="sm" variant="ghost" className="h-7 text-xs">Log joint touch</Button>} />
                    </li>
                  ))}
                </ul>
              )}
              {p.registrations.length > 0 && (
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${p.company} registrations`} data-field="partner.registrations">
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-muted-foreground text-xs"><tr>{["Account", "Deal", "Rep", "Reference", "Status", "Expires"].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{p.registrations.map((g) => (
                      <tr key={g.id}>
                        <td className="py-1.5 pr-3"><Link href={`/accounts/${g.account.id}`} className="hover:underline">{g.account.name}</Link></td>
                        <td className="py-1.5 pr-3">{g.opportunity?.name ?? "—"}</td>
                        <td className="py-1.5 pr-3">{g.rep?.name ?? "—"}</td>
                        <td className="py-1.5 pr-3">{g.reference ?? "—"}</td>
                        <td className={`py-1.5 pr-3 ${g.expired ? "text-critical-text" : ""}`}>{g.expired ? "expired" : g.status}</td>
                        <td className="py-1.5 pr-3">{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
