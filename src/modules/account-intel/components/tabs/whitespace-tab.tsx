"use client";
import { Check, KanbanSquare, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_PRACTICE_AREAS } from "@/config/practice-areas";
import { PRACTICE_STATUSES, type PracticeStatus } from "@/lib/domain/enums";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  CreateOppDialog,
  type CreateOppDefaults,
} from "@/modules/opportunities/components/create-opp-dialog";
import type { Account360 } from "../../hooks/use-accounts";
import { useAccountMutation } from "../../hooks/use-accounts";

export const STATUS_META: Record<PracticeStatus, { label: string; cls: string; step: number }> = {
  NotEngaged: {
    label: "Not engaged",
    cls: "bg-muted text-muted-foreground border-dashed",
    step: 0,
  },
  Exploring: {
    label: "Exploring",
    cls: "bg-[var(--seq-100)] text-foreground dark:text-foreground",
    step: 1,
  },
  ActiveOpp: { label: "Active opp", cls: "bg-[var(--seq-400)] text-white", step: 2 },
  Delivered: {
    label: "Delivered",
    cls: "bg-[var(--seq-700)] text-white dark:text-[#0b0b0b]",
    step: 3,
  },
};

export function WhitespaceTab({ d }: { d: Account360 }) {
  const id = d.account.id;
  const [creating, setCreating] = useState<CreateOppDefaults | null>(null);
  const setStatus = useAccountMutation(
    id,
    (v: { practiceArea: string; status: PracticeStatus }) =>
      api(`/api/accounts/${id}/practice-status`, { method: "PUT", json: v }),
    "Whitespace updated",
  );
  const status = new Map(d.practiceStatus.map((p) => [p.practiceArea, p.status as PracticeStatus]));
  const demand = new Map(d.whitespace.components.map((c) => [c.id, c]));

  return (
    <div className="grid gap-4">
      <section className="bg-card rounded-lg border p-4">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Whitespace map</h2>
            <p className="text-muted-foreground text-xs">
              Practice areas × engagement. Click a cell to change status, create an opportunity, or
              find a play.
            </p>
          </div>
          <ul className="text-muted-foreground flex flex-wrap gap-3 text-xs" aria-label="Legend">
            {PRACTICE_STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded-sm border", STATUS_META[s].cls)} aria-hidden />{" "}
                {STATUS_META[s].label}
              </li>
            ))}
          </ul>
        </header>
        <div
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
          role="grid"
          aria-label="Whitespace map"
        >
          {DEFAULT_PRACTICE_AREAS.map((p) => {
            const s = status.get(p.id) ?? "NotEngaged";
            const comp = demand.get(p.id);
            return (
              <DropdownMenu key={p.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    role="gridcell"
                    aria-label={`${p.label}: ${STATUS_META[s].label}`}
                    className="focus-visible:ring-ring flex items-stretch overflow-hidden rounded-md border text-left transition-shadow hover:shadow-sm focus-visible:ring-2"
                  >
                    <span
                      className={cn(
                        "flex w-28 shrink-0 items-center justify-center border-r px-2 text-center text-xs font-medium",
                        STATUS_META[s].cls,
                      )}
                    >
                      {STATUS_META[s].label}
                    </span>
                    <span className="min-w-0 flex-1 px-3 py-2.5">
                      <span className="block truncate text-[13px] font-medium">{p.label}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {comp
                          ? `Demand ${comp.input.split("demand ")[1] ?? "—"} · +${comp.contribution.toFixed(1)} whitespace pts`
                          : p.description}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>{p.label}</DropdownMenuLabel>
                  {PRACTICE_STATUSES.map((st) => (
                    <DropdownMenuItem
                      key={st}
                      onSelect={() =>
                        st !== s && setStatus.mutate({ practiceArea: p.id, status: st })
                      }
                    >
                      {st === s ? <Check /> : <span className="size-4" />} {STATUS_META[st].label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setCreating({
                        account: { id, name: d.account.name },
                        practiceArea: p.id,
                        name: `${d.account.name.split(" ")[0]} — ${p.short}`,
                      })
                    }
                  >
                    <KanbanSquare /> Create opportunity
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/demand-gen?tab=recommender&account=${id}&practice=${p.id}`}>
                      <Lightbulb /> Find a play
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      </section>
      <CreateOppDialog
        open={!!creating}
        onOpenChange={(o) => !o && setCreating(null)}
        defaults={creating ?? undefined}
      />
    </div>
  );
}
