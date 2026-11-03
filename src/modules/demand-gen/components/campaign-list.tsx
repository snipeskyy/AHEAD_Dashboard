"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useCampaigns, useInvalidateDemandGen } from "../hooks/use-demand-gen";

export function CampaignList() {
  const { data } = useCampaigns();
  const inv = useInvalidateDemandGen();
  const setStatus = async (id: string, status: string) => {
    await api(`/api/campaigns/${id}`, { method: "PATCH", json: { status } });
    inv();
  };
  const remove = async (id: string) => {
    await api(`/api/campaigns/${id}`, { method: "DELETE" });
    toast.success("Campaign deleted (planned touches removed)");
    inv();
  };
  const [all, setAll] = useState(false);
  const active = (data ?? []).filter((c) => c.status !== "complete");
  return (
    <section className="bg-card rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          Active campaigns{" "}
          <span className="text-muted-foreground font-normal">{active.length}</span>
        </h2>
      </header>
      <ul className="divide-y">
        {(all ? active : active.slice(0, 10)).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{c.playName ?? c.name}</div>
              <div className="text-muted-foreground text-xs">
                {c.accountId ? (
                  <Link href={`/accounts/${c.accountId}`} className="hover:underline">
                    {c.accountName}
                  </Link>
                ) : (
                  "—"
                )}{" "}
                · {c.completed}/{c.touches} touches · {c.meetings} meetings
                {c.nextTouchAt
                  ? ` · next ${formatDistanceToNowStrict(new Date(c.nextTouchAt), { addSuffix: true })}`
                  : ""}
              </div>
            </div>
            <Badge variant="outline" className="font-normal capitalize">
              {c.status}
            </Badge>
            <div className="flex gap-0.5">
              {c.status === "paused" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Resume campaign"
                  onClick={() => setStatus(c.id, "active")}
                >
                  <Play />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Pause campaign"
                  onClick={() => setStatus(c.id, "paused")}
                >
                  <Pause />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete campaign"
                onClick={() => remove(c.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
        {active.length === 0 && (
          <li className="text-muted-foreground px-4 py-6 text-center text-sm">
            No active campaigns. Launch a play from the library or recommender.
          </li>
        )}
      </ul>
      {active.length > 10 && (
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${active.length}`}
          </Button>
        </div>
      )}
    </section>
  );
}
