"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, CalendarPlus, ClipboardList, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrencyCompact } from "@/lib/format";
import type { MyDay } from "@/lib/server/my-day";
import { TaskList } from "@/modules/tasks/components/task-list";
import type { TaskRow } from "@/modules/tasks/components/use-tasks";

type S = { action: string; reason: string };

/** "→ action" with the reason underneath: every suggestion explains itself. */
export function Suggest({ s }: { s: S }) {
  return (
    <div className="text-xs">
      <span className="text-primary inline-flex items-center gap-1 font-medium"><ArrowRight className="size-3" aria-hidden /> {s.action}</span>
      <span className="text-muted-foreground block">{s.reason}</span>
    </div>
  );
}

export function Section({ title, count, action, children, empty }: { title: string; count?: number; action?: ReactNode; children: ReactNode; empty?: string }) {
  return (
    <section className="bg-card flex flex-col gap-2 rounded-lg border p-4" aria-label={title}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}{count !== undefined && <span className="text-muted-foreground font-normal"> · {count}</span>}</h2>
        {action}
      </header>
      {count === 0 && empty ? <p className="text-muted-foreground py-2 text-[13px]">{empty}</p> : children}
    </section>
  );
}

export function CalendarImport({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const up = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/meetings/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Import failed");
      return data as { imported: number; matched: number };
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} meetings`, { description: `${r.matched} matched to accounts by attendee domain. Only titles, times and domains are stored.` });
      qc.invalidateQueries({ queryKey: ["my-day"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <input ref={ref} type="file" accept=".ics,text/calendar" className="sr-only" aria-label="Calendar file (.ics)" onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ""; }} />
      <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 text-xs" : ""} disabled={up.isPending} onClick={() => ref.current?.click()}>
        {compact ? <Upload /> : <CalendarPlus />} {compact ? "Re-import" : "Import calendar (.ics)"}
      </Button>
    </>
  );
}

export function Meetings({ items }: { items: MyDay["meetings"] }) {
  return (
    <ul className="divide-y">
      {items.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-3 py-2 text-[13px]">
          <div className="min-w-0">
            <div className="font-medium">{format(new Date(m.startsAt), "EEE h:mm a")} · {m.title}</div>
            <div className="text-muted-foreground text-xs">{m.account ? <Link href={`/accounts/${m.account.id}`} className="hover:underline">{m.account.name}</Link> : "No account matched"}{m.location ? ` · ${m.location}` : ""}</div>
            <Suggest s={m.suggestion} />
          </div>
          {m.account && <Button size="sm" variant="outline" className="h-7 shrink-0" asChild><Link href={`/accounts/${m.account.id}/brief`}><ClipboardList /> Prep brief</Link></Button>}
        </li>
      ))}
    </ul>
  );
}

export function Signals({ items }: { items: MyDay["signals"] }) {
  return (
    <ol className="divide-y">
      {items.map((s) => (
        <li key={s.id} className="py-2 text-[13px]">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/signals?focus=${s.id}`} className="font-medium hover:underline">{s.title}</Link>
            <span className="tabular text-muted-foreground shrink-0 text-xs" data-internal-only="true">{Math.round(s.relevance)}</span>
          </div>
          <div className="text-muted-foreground text-xs"><Link href={`/accounts/${s.accountId}`} className="hover:underline">{s.accountName}</Link> · {s.type.replace(/-/g, " ")}</div>
          <Suggest s={s.suggestion} />
        </li>
      ))}
    </ol>
  );
}

export function Tasks({ items }: { items: MyDay["tasks"] }) {
  const rows = items.map((t) => ({ ...t, dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null, createdAt: undefined })) as unknown as TaskRow[];
  return <TaskList items={rows} compact />;
}

export function Cadence({ items }: { items: MyDay["cadence"] }) {
  return (
    <ul className="divide-y">
      {items.map((a) => (
        <li key={a.id} className="py-2 text-[13px]">
          <Link href={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link> <span className="text-muted-foreground text-xs">· {a.tier}</span>
          <Suggest s={a.suggestion} />
        </li>
      ))}
    </ul>
  );
}

export function Deals({ items }: { items: MyDay["deals"] }) {
  return (
    <ul className="divide-y">
      {items.map((o) => (
        <li key={o.id} className="py-2 text-[13px]">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/opportunities?focus=${o.id}`} className="font-medium hover:underline">{o.name}</Link>
            <span className="tabular shrink-0 text-xs" data-internal-only="true">{formatCurrencyCompact(o.amount)}</span>
          </div>
          <div className="text-muted-foreground text-xs">{o.accountName} · {o.stage} · closes {format(new Date(o.closeDate), "MMM d")}</div>
          <Suggest s={o.suggestion} />
        </li>
      ))}
    </ul>
  );
}

export function Fiscal({ items }: { items: MyDay["fiscal"] }) {
  return (
    <ul className="divide-y">
      {items.map((f) => (
        <li key={f.id} className="py-2 text-[13px]">
          <Link href={`/accounts/${f.id}`} className="font-medium hover:underline">{f.name}</Link>
          <Suggest s={f.suggestion} />
        </li>
      ))}
    </ul>
  );
}
