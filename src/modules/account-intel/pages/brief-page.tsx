"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, ExternalLink, FileDown, Presentation, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatCurrencyCompact } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import type { Brief } from "@/lib/server/brief";

function Card({ title, children, internal, className = "" }: { title: string; children: React.ReactNode; internal?: boolean; className?: string }) {
  return (
    <section className={`bg-card rounded-lg border p-4 break-inside-avoid ${className}`} data-internal-only={internal ? "true" : undefined} aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
const d = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** One-page meeting prep: opens in Presentation Mode or exports (internal audience) to PDF / Markdown. */
export default function BriefPage({ params }: { params: Record<string, string> }) {
  const id = params.id;
  const { data: b, isLoading, error, refetch } = useQuery({ queryKey: ["brief", id], queryFn: () => api<Brief>(`/api/accounts/${id}/brief`) });
  const presenting = useUiStore((s) => s.presentationMode);
  const setPresenting = useUiStore((s) => s.setPresentationMode);
  const exp = useMutation({
    mutationFn: (format: "pdf" | "markdown") =>
      api<{ job: { id: string } }>("/api/exports", {
        method: "POST",
        json: {
          format,
          config: { title: `Meeting prep — ${b!.account.name}`, scope: { type: "account", accountIds: [id] }, sections: ["account-intel.brief"], audience: "internal", watermark: "INTERNAL ONLY", hiddenFields: [], dateStamp: true, version: 1, preparedBy: "" },
        },
      }),
    onSuccess: (r) => {
      toast.success("Brief exported");
      window.open(`/api/exports/${r.job.id}/download`, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <PageContainer><CardSkeleton lines={10} /></PageContainer>;
  if (error || !b) return <PageContainer><ErrorState error={error} onRetry={() => refetch()} /></PageContainer>;
  return (
    <PageContainer>
      <Link href={`/accounts/${id}`} className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs" data-print-hide="true"><ArrowLeft className="size-3" /> {b.account.name}</Link>
      <PageHeader
        title={`Meeting prep · ${b.account.name}`}
        description={b.meeting ? `${b.meeting.title} · ${new Date(b.meeting.startsAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "No upcoming meeting imported for this account."}
        actions={
          <div className="flex flex-wrap gap-2" data-print-hide="true">
            <Button size="sm" variant={presenting ? "default" : "outline"} onClick={() => setPresenting(!presenting)}><Presentation /> {presenting ? "Exit presentation" : "Present"}</Button>
            <Button size="sm" variant="outline" disabled={exp.isPending} onClick={() => exp.mutate("pdf")}><FileDown /> PDF</Button>
            <Button size="sm" variant="outline" disabled={exp.isPending} onClick={() => exp.mutate("markdown")}><FileDown /> Markdown</Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer /> Print</Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Snapshot" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
            {[["Industry", b.account.industry], ["HQ", b.account.hq ?? "—"], ["Size", [b.account.employeeBand, b.account.revenueBand].filter(Boolean).join(" · ") || "—"], ["Tier", b.account.tier], ["CEO", b.account.ceo ?? "—"], ["Health", `${b.account.healthScore}/100`]].map(([k, v]) => (
              <div key={k} data-internal-only={k === "Tier" || k === "Health" ? "true" : undefined}><dt className="text-muted-foreground text-xs">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {b.account.description && <p className="text-muted-foreground mt-2 line-clamp-4 text-[13px]">{b.account.description}</p>}
          {b.fiscal && <p className="mt-2 inline-flex items-center gap-1 text-xs"><CalendarClock className="size-3" aria-hidden /> {b.fiscal.label}</p>}
        </Card>
        <Card title="Suggested questions" internal>
          <ol className="grid list-decimal gap-2 pl-4 text-[13px]">
            {b.questions.map((q) => <li key={q.q}><div>{q.q}</div><div className="text-muted-foreground text-xs">Why: {q.why}</div></li>)}
          </ol>
        </Card>
        <Card title="Latest signals" internal>
          {b.signals.length ? <ul className="grid gap-1.5 text-[13px]">{b.signals.map((s) => <li key={s.id}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.title} <ExternalLink className="inline size-3" /></a> : s.title}<div className="text-muted-foreground text-xs">{s.type} · {d(s.publishedAt)}</div></li>)}</ul> : <p className="text-muted-foreground text-[13px]">No signals yet.</p>}
        </Card>
        <Card title="Open opportunities" internal>
          {b.opps.length ? <ul className="grid gap-1.5 text-[13px]">{b.opps.map((o) => <li key={o.id}><Link href={`/opportunities?focus=${o.id}`} className="font-medium hover:underline">{o.name}</Link><div className="text-muted-foreground text-xs">{o.stage} · {formatCurrencyCompact(o.amount)} · closes {d(o.closeDate)} · MEDDPICC {o.meddpiccScore}%{o.nextStep ? ` · next: ${o.nextStep}` : ""}</div></li>)}</ul> : <p className="text-muted-foreground text-[13px]">No open deals.</p>}
        </Card>
        <Card title="Buying committee" internal>
          <ul className="grid gap-1 text-[13px]">{b.committee.contacts.map((c, i) => <li key={i}>{[c.name, c.title].filter(Boolean).join(", ")} <span className="text-muted-foreground text-xs">· {c.role} · {c.engagement}</span></li>)}</ul>
          {b.committee.gaps.map((g) => <p key={g} className="text-warning-text mt-1 text-xs">{g}</p>)}
        </Card>
        <Card title="Last 3 touches" internal>
          {b.touches.length ? <ul className="grid gap-1 text-[13px]">{b.touches.map((t, i) => <li key={i}>{t.channel} with {t.persona}<div className="text-muted-foreground text-xs">{d(t.completedAt)}{t.outcome ? ` · ${t.outcome}` : ""}{t.angle ? ` · ${t.angle}` : ""}</div></li>)}</ul> : <p className="text-muted-foreground text-[13px]">No touches logged.</p>}
        </Card>
        <Card title="Initiative evidence" className="lg:col-span-2">
          {b.initiatives.length ? <ul className="grid gap-2 text-[13px]">{b.initiatives.map((i) => <li key={i.title}><span className="font-medium">{i.title}</span>{i.evidence && <p className="text-muted-foreground text-xs italic">“{i.evidence}”</p>}<div className="text-muted-foreground text-xs">{[i.section, i.source].filter(Boolean).join(" · ")}{i.sourceUrl && <> · <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">source</a></>}</div></li>)}</ul> : <p className="text-muted-foreground text-[13px]">No evidence yet. Enrich the account to pull it from public sources.</p>}
        </Card>
        <Card title="Recommended plays" internal>
          {b.plays.length ? <ul className="grid gap-1.5 text-[13px]">{b.plays.map((p) => <li key={p.name}><span className="font-medium">{p.name}</span><div className="text-muted-foreground text-xs">{p.reasons.slice(0, 2).join("; ")}</div></li>)}</ul> : <p className="text-muted-foreground text-[13px]">No plays matched yet.</p>}
        </Card>
      </div>
    </PageContainer>
  );
}
