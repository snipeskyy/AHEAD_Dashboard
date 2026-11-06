"use client";
import { Check, ExternalLink, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayValue, FIELD_BY_ID, listKind, SECTION_LABELS } from "@/lib/enrich/fields";
import { groupConflicts } from "@/lib/enrich/merge";
import {
  useDecideProposals,
  type AccountEnrichment,
  type Proposal,
} from "../../hooks/use-enrichment";
import { ConfidenceBadge } from "./source-indicator";

const LIST_SECTION: Record<string, string> = {
  initiative: "Initiative evidence",
  tech: "Tech-stack hypotheses",
  contact: "Buying committee suggestions",
};
const sectionOf = (f: string) => listKind(f) ?? FIELD_BY_ID.get(f)?.section ?? "other";
const sectionLabel = (s: string) =>
  LIST_SECTION[s] ?? SECTION_LABELS[s as keyof typeof SECTION_LABELS] ?? "Other";

function label(p: Proposal) {
  const k = listKind(p.field);
  const v = p.value as Record<string, string>;
  if (k === "initiative") return v.title;
  if (k === "tech") return `${v.technology} (${v.category})`;
  if (k === "contact") return `${v.name}, ${v.title}`;
  return FIELD_BY_ID.get(p.field)?.label ?? p.field;
}

/** Field-by-field review: current vs proposed, source, confidence, evidence. Accept all / by section / per item. */
export function ProposalsPanel({ accountId, d }: { accountId: string; d: AccountEnrichment }) {
  const decide = useDecideProposals(accountId);
  const current = new Map(d.fields.map((f) => [f.field, f]));
  const bySection = new Map<string, Proposal[]>();
  for (const p of d.proposals)
    bySection.set(sectionOf(p.field), [...(bySection.get(sectionOf(p.field)) ?? []), p]);
  if (!d.proposals.length) return null;
  return (
    <section className="bg-card grid gap-3 rounded-lg border p-4" aria-labelledby="prop-h">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="prop-h" className="text-sm font-semibold">
            Proposed updates ({d.proposals.length})
          </h2>
          <p className="text-muted-foreground text-xs">
            From public sources. Nothing changes until you accept. Fields you edited are locked and
            only show newer public values here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ action: "accept" })}
          >
            <Check /> Accept all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ action: "reject" })}
          >
            <X /> Reject all
          </Button>
        </div>
      </header>
      {[...bySection.entries()].map(([section, items]) => (
        <div key={section} className="grid gap-1">
          <div className="flex items-center justify-between border-b pb-1">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {sectionLabel(section)}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={() => decide.mutate({ action: "accept", section })}
            >
              Accept section
            </Button>
          </div>
          <ul className="divide-y">
            {groupConflicts(items).flatMap((g) =>
              g.items.map((p) => {
                const cur = current.get(p.field);
                return (
                  <li
                    key={p.id}
                    className="grid gap-1 py-2 text-[13px] md:grid-cols-[1fr_auto] md:items-start"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{label(p)}</span>
                        <ConfidenceBadge c={p.confidence} />
                        {g.conflict && (
                          <span className="text-warning-text text-[10px] font-medium uppercase">
                            Conflict: pick one
                          </span>
                        )}
                        {cur?.locked && (
                          <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px] uppercase">
                            <Lock className="size-2.5" aria-hidden /> Newer public value available
                          </span>
                        )}
                      </div>
                      {!listKind(p.field) && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            {cur ? displayValue(p.field, cur.value) : "—"}
                          </span>{" "}
                          → <span className="font-medium">{displayValue(p.field, p.value)}</span>
                        </div>
                      )}
                      {p.evidenceSnippet && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-3 text-xs italic">
                          “{p.evidenceSnippet}”
                        </p>
                      )}
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        {p.source} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        aria-label={`Accept ${label(p)}`}
                        onClick={() => decide.mutate({ action: "accept", ids: [p.id] })}
                      >
                        <Check /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        aria-label={`Reject ${label(p)}`}
                        onClick={() => decide.mutate({ action: "reject", ids: [p.id] })}
                      >
                        <X />
                      </Button>
                    </div>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      ))}
    </section>
  );
}
