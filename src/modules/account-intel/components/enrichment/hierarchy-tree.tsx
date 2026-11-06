"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Network, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { AccountEnrichment } from "../../hooks/use-enrichment";

type Rel = AccountEnrichment["relations"][number];

function RelItem({ r }: { r: Rel }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: () =>
      api(`/api/relations/${r.id}`, { method: "POST", json: { action: "create-account" } }),
    onSuccess: () => {
      toast.success(`${r.name} added as an account`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <li className="flex items-center justify-between gap-2 py-1 text-[13px]">
      <span className="min-w-0 truncate">
        {r.linkedAccountId ? (
          <Link href={`/accounts/${r.linkedAccountId}`} className="font-medium hover:underline">
            {r.name}
          </Link>
        ) : (
          r.name
        )}
        {r.country && <span className="text-muted-foreground"> · {r.country}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <a
          href={r.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground text-[10px] uppercase"
          aria-label={`${r.name} on ${r.source}`}
        >
          {r.source} <ExternalLink className="inline size-2.5" aria-hidden />
        </a>
        {!r.linkedAccountId && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-xs"
            disabled={act.isPending}
            onClick={() => act.mutate()}
            aria-label={`Add ${r.name} as an account`}
          >
            <Plus className="size-3" /> Account
          </Button>
        )}
      </span>
    </li>
  );
}

/** Ultimate parent → parent → this account → subsidiaries (GLEIF + Wikidata), with roll-up into ACC. */
export function HierarchyTree({ name, d }: { name: string; d: AccountEnrichment }) {
  const [all, setAll] = useState(false);
  const ult = d.relations.filter((r) => r.relation === "ultimate-parent");
  const par = d.relations.filter((r) => r.relation === "direct-parent");
  const subs = d.relations.filter((r) => r.relation === "subsidiary");
  if (!d.relations.length) return null;
  const shown = all ? subs : subs.slice(0, 12);
  return (
    <section className="bg-card grid gap-2 rounded-lg border p-4" aria-labelledby="hier-h">
      <h2 id="hier-h" className="flex items-center gap-1.5 text-sm font-semibold">
        <Network className="size-4" aria-hidden /> Corporate hierarchy
      </h2>
      <ul className="grid gap-0.5" aria-label="Parents">
        {ult.map((r) => (
          <RelItem key={r.id} r={{ ...r, name: `${r.name} (ultimate parent)` }} />
        ))}
        {par.map((r) => (
          <RelItem key={r.id} r={{ ...r, name: `${r.name} (parent)` }} />
        ))}
      </ul>
      <div className="border-primary/40 bg-brand-soft rounded-md border-l-2 px-2 py-1 text-[13px] font-semibold">
        {name}
      </div>
      {subs.length > 0 && (
        <div className="pl-4">
          <div className="text-muted-foreground text-xs">{subs.length} subsidiaries</div>
          <ul className="divide-y" aria-label="Subsidiaries">
            {shown.map((r) => (
              <RelItem key={r.id} r={r} />
            ))}
          </ul>
          {subs.length > 12 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${subs.length}`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
