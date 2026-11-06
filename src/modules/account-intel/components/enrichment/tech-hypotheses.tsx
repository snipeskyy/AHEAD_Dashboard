"use client";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account360 } from "../../hooks/use-accounts";
import { SourceTag } from "../evidence-link";

type Tech = Account360["techStack"][number] & { status?: string };
const STATUS = {
  confirmed: { label: "Confirmed", cls: "text-good-text" },
  rejected: { label: "Rejected", cls: "text-muted-foreground line-through" },
  hypothesis: { label: "Hypothesis", cls: "text-muted-foreground" },
} as const;

/** Tech-stack hypotheses grouped by category, each with evidence; the user confirms or rejects them. */
export function TechHypotheses({
  items,
  onStatus,
  onDelete,
}: {
  items: Tech[];
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const groups = new Map<string, Tech[]>();
  for (const t of items) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  return (
    <div className="grid gap-3">
      {[...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, list]) => (
          <div key={cat}>
            <h3 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
              {cat}
            </h3>
            <ul className="divide-y">
              {list.map((t) => {
                const s =
                  STATUS[(t.status as keyof typeof STATUS) ?? "hypothesis"] ?? STATUS.hypothesis;
                return (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 py-1.5 text-[13px]"
                  >
                    <div className="min-w-0">
                      <span
                        className={
                          t.status === "rejected" ? "line-through opacity-60" : "font-medium"
                        }
                      >
                        {t.technology}
                      </span>{" "}
                      <span className={`text-[10px] uppercase ${s.cls}`}>{s.label}</span>
                      <p className="text-muted-foreground text-xs">
                        {t.evidence} <SourceTag source={t.source} url={t.sourceUrl} />
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {t.status !== "confirmed" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Confirm ${t.technology}`}
                          onClick={() => onStatus(t.id, "confirmed")}
                        >
                          <Check />
                        </Button>
                      )}
                      {t.status !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Reject ${t.technology}`}
                          onClick={() => onStatus(t.id, "rejected")}
                        >
                          <X />
                        </Button>
                      )}
                      {t.status && t.status !== "hypothesis" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Reset ${t.technology} to hypothesis`}
                          onClick={() => onStatus(t.id, "hypothesis")}
                        >
                          <RotateCcw />
                        </Button>
                      )}
                      {t.source === "user-hypothesis" && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${t.technology}`}
                          onClick={() => onDelete(t.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}
