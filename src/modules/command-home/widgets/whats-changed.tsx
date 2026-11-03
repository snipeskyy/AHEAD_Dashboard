"use client";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { WidgetProps } from "@/modules/types";

interface Changes {
  since: string;
  counts: { activity: number; stageChanges: number; highSignals: number };
  activity: Array<{ id: string; summary: string; at: string; href: string | null }>;
  signals: Array<{ id: string; title: string; accountName: string; relevance: number }>;
}

/** "What changed since you last looked" — ActivityLog + new high-relevance signals since ui.lastSeenAt. */
export default function WhatsChangedWidget({ height }: WidgetProps) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "changes"],
    queryFn: () => api<Changes>("/api/dashboard/changes"),
  });
  const seen = useMutation({
    mutationFn: () => api("/api/dashboard/changes", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "changes"] }),
  });
  if (isLoading || !data) return <Skeleton style={{ height }} />;
  const items = [
    ...data.signals.map((s) => ({
      id: `s-${s.id}`,
      text: s.title,
      sub: (
        <>
          {s.accountName}
          <span data-internal-only="true"> · relevance {Math.round(s.relevance)}</span>
        </>
      ) as React.ReactNode,
      href: `/signals?focus=${s.id}`,
    })),
    ...data.activity.map((a) => ({
      id: `a-${a.id}`,
      text: a.summary,
      sub: formatDistanceToNowStrict(new Date(a.at), { addSuffix: true }) as React.ReactNode,
      href: a.href,
    })),
  ];
  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="text-muted-foreground text-xs">
          Since {formatDistanceToNowStrict(new Date(data.since), { addSuffix: true })}:{" "}
          <strong className="text-foreground">{data.counts.highSignals}</strong> high signals ·{" "}
          <strong className="text-foreground">{data.counts.stageChanges}</strong> stage moves
        </p>
        <Button variant="ghost" size="xs" onClick={() => seen.mutate()} disabled={seen.isPending}>
          <CheckCheck /> Mark seen
        </Button>
      </div>
      <ul className="-mx-4 min-h-0 flex-1 divide-y overflow-y-auto border-t">
        {items.length === 0 && (
          <li className="text-muted-foreground px-4 py-6 text-center text-[13px]">
            Nothing new since your last visit.
          </li>
        )}
        {items.map((i) => (
          <li key={i.id} className="px-4 py-2">
            {i.href ? (
              <Link href={i.href} className="block">
                <span className="line-clamp-2 text-[13px]">{i.text}</span>
                <span className="text-muted-foreground text-[11px]">{i.sub}</span>
              </Link>
            ) : (
              <>
                <span className="line-clamp-2 text-[13px]">{i.text}</span>
                <span className="text-muted-foreground text-[11px]">{i.sub}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
