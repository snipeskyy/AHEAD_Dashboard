"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Inbox, Plus } from "lucide-react";
import Link from "next/link";
import { StatTile } from "@/components/kpi/stat-tile";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CardSkeleton, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeta } from "@/hooks/use-meta";
import { api } from "@/lib/api-client";
import type { MyDay } from "@/lib/server/my-day";
import { Onboarding } from "@/modules/command-home/components/onboarding";
import { useUiStore } from "@/stores/ui-store";
import { CalendarImport, Cadence, Deals, Fiscal, Meetings, Section, Signals, Tasks } from "../components/sections";

function greeting(h: number) {
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Default landing page: what needs you today, each item with a suggested next action and its reason. */
export default function MyDayPage() {
  const meta = useMeta();
  if (meta.isLoading) return <Skeleton className="m-6 h-64" />;
  if (meta.data?.empty) return <Onboarding />;
  return <Day />;
}

function Day() {
  const qc = useQueryClient();
  const openTask = useUiStore((s) => s.openTaskDialog);
  const { data: d, isLoading, error, refetch } = useQuery({ queryKey: ["my-day"], queryFn: () => api<MyDay>("/api/my-day"), refetchInterval: 120_000 });
  const seen = useMutation({
    mutationFn: () => api("/api/my-day/seen", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-day"] }),
  });
  if (isLoading) return <PageContainer><CardSkeleton lines={10} /></PageContainer>;
  if (error || !d) return <PageContainer><ErrorState error={error} onRetry={() => refetch()} /></PageContainer>;
  const now = new Date(d.now);
  const today = d.meetings.filter((m) => new Date(m.startsAt).toDateString() === now.toDateString());
  return (
    <PageContainer>
      <PageHeader
        title={`${greeting(now.getHours())}`}
        description={`${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · signals since ${new Date(d.since).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}
        actions={
          <>
            <Button size="sm" variant="outline" asChild><Link href="/signals?tab=triage"><Inbox /> Triage signals</Link></Button>
            <Button size="sm" variant="outline" onClick={() => seen.mutate()} disabled={seen.isPending}><CheckCheck /> Mark all seen</Button>
            <Button size="sm" onClick={() => openTask({ source: "my-day" })}><Plus /> Task</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Meetings today" value={today.length} />
        <StatTile label="Tasks due" value={d.tasks.length} tone={d.tasks.some((t) => t.suggestion.reason.startsWith("Overdue")) ? "critical" : undefined} sub={d.tasks.length ? "overdue + today" : undefined} />
        <StatTile label="New signals" value={d.signals.length} sub="top by relevance" />
        <StatTile label="Past cadence" value={d.cadence.length} tone={d.cadence.length ? "warning" : "good"} />
        <StatTile label="Deals needing attention" value={d.deals.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Meetings (today & tomorrow)" count={d.meetings.length} action={<CalendarImport compact={d.meetings.length > 0} />} empty="No meetings imported. Export your calendar as .ics (Outlook or Google Calendar) and import it; only titles, times and attendee domains are kept.">
          <Meetings items={d.meetings} />
        </Section>
        <Section title="Top signals" count={d.signals.length} action={<Button size="sm" variant="ghost" className="h-7 text-xs" asChild><Link href="/signals?tab=triage">Triage all</Link></Button>} empty="No new signals. Check Live Signals → Source coverage if this stays empty.">
          <Signals items={d.signals} />
        </Section>
        <Section title="Tasks due" count={d.tasks.length} action={<Button size="sm" variant="ghost" className="h-7 text-xs" asChild><Link href="/tasks">All tasks</Link></Button>} empty="Nothing due today. Press T to add a task, C to capture meeting notes.">
          <Tasks items={d.tasks} />
        </Section>
        <Section title="Deals needing attention" count={d.deals.length} action={<Button size="sm" variant="ghost" className="h-7 text-xs" asChild><Link href="/opportunities">Pipeline</Link></Button>} empty="Every open deal has a dated next step and none are stalled or closing within 30 days.">
          <Deals items={d.deals} />
        </Section>
        <Section title="Accounts past their cadence" count={d.cadence.length} action={<Button size="sm" variant="ghost" className="h-7 text-xs" asChild><Link href="/territory">Territory</Link></Button>} empty="Every account is within its touch cadence.">
          <Cadence items={d.cadence} />
        </Section>
        <Section title="Budget timing" count={d.fiscal.length} empty="No accounts in or near a likely budget-planning window.">
          <Fiscal items={d.fiscal} />
        </Section>
      </div>
    </PageContainer>
  );
}
