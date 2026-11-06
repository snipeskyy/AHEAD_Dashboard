"use client";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEFAULT_PRACTICE_AREAS, practiceLabel } from "@/config/practice-areas";
import type { Account360 } from "../../hooks/use-accounts";
import { SourceTag } from "../evidence-link";

type Init = Account360["initiatives"][number] & {
  evidence?: string | null;
  section?: string | null;
};

/** Initiative evidence grouped by practice area: each item cites its snippet, section and public source. */
export function EvidenceBoard({
  items,
  onDelete,
}: {
  items: Init[];
  onDelete: (id: string) => void;
}) {
  const groups = new Map<string, Init[]>();
  for (const i of items)
    for (const p of i.practiceAreas.length ? i.practiceAreas : ["other"])
      groups.set(p, [...(groups.get(p) ?? []), i]);
  const order = [...DEFAULT_PRACTICE_AREAS.map((p) => p.id), "other"].filter((p) => groups.has(p));
  return (
    <div className="grid gap-3">
      {order.map((p) => (
        <div key={p}>
          <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
            {p === "other" ? "Other" : practiceLabel(p)} · {groups.get(p)!.length}
          </h3>
          <ul className="divide-y">
            {groups.get(p)!.map((i) => (
              <li
                key={`${p}-${i.id}`}
                className="group flex items-start justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{i.title}</div>
                  {i.evidence && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-3 text-xs italic">
                      “{i.evidence}”
                    </p>
                  )}
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {[i.section, i.description].filter(Boolean).join(" · ")}
                  </div>
                  {i.practiceAreas.length > 1 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.practiceAreas
                        .filter((x) => x !== p)
                        .map((x) => (
                          <Badge key={x} variant="secondary" className="font-normal">
                            {practiceLabel(x, true)}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-xs" data-internal-only="true">
                    {Math.round(i.confidence * 100)}%
                  </span>
                  <SourceTag source={i.source} url={i.sourceUrl} />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${i.title}`}
                    onClick={() => onDelete(i.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
