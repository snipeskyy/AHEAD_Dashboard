"use client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, History, Radio, Send, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CardSkeleton, EmptyState } from "@/components/states";
import { api } from "@/lib/api-client";

interface Item {
  id: string;
  kind: "activity" | "touch" | "note" | "signal";
  at: string;
  title: string;
  detail: string | null;
  href: string | null;
}

const ICONS: Record<Item["kind"], LucideIcon> = {
  activity: History,
  touch: Send,
  note: FileText,
  signal: Radio,
};

export function ActivityTab({ accountId }: { accountId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["account-activity", accountId],
    queryFn: () =>
      api<{ items: Item[] }>(`/api/accounts/${accountId}/activity`).then((r) => r.items),
  });
  if (isLoading) return <CardSkeleton lines={8} />;
  if (!data?.length) return <EmptyState title="No activity yet" />;
  const days = data.map((i) => format(new Date(i.at), "EEEE, MMM d, yyyy"));
  return (
    <ol className="bg-card grid gap-0 rounded-lg border p-4">
      {data.map((i, idx) => {
        const header = idx === 0 || days[idx] !== days[idx - 1] ? days[idx] : null;
        const Icon = ICONS[i.kind];
        const body = (
          <div className="flex gap-3 py-2">
            <span className="bg-muted text-muted-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-md">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">{i.title}</p>
              <p className="text-muted-foreground text-[11px]">
                <span className="capitalize">{i.kind}</span>
                {i.detail ? ` · ${i.detail}` : ""} · {format(new Date(i.at), "h:mm a")}
              </p>
            </div>
          </div>
        );
        return (
          <li key={`${i.kind}-${i.id}`} data-field={i.kind === "note" ? "notes" : undefined}>
            {header && (
              <h3 className="text-muted-foreground mt-3 mb-1 text-xs font-medium first:mt-0">
                {header}
              </h3>
            )}
            {i.href ? (
              <Link href={i.href} className="hover:bg-muted/50 block rounded-md">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
